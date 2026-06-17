// src/shared/cache/cache.client.ts
//
// Cross-cutting cache abstraction. Follows the adapter + factory pattern used by
// the external clients (storage.client / oidc.client): an interface, one or more
// concrete implementations, and a factory that picks one from config.
//
// HARD RULE: the cache must never break a request. Every operation is wrapped so
// that a cache outage degrades to a miss (the caller re-computes) rather than
// throwing. This keeps the dashboard working even if Redis is down.
import { createClient, type RedisClientType } from 'redis';
import NodeCache from 'node-cache';
import { config } from '../config/app.config';
import { logger } from '../utils/logger.util';

export interface ICacheClient {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /**
   * Return the cached value for `key`, or run `loader`, cache its result for
   * `ttlSeconds`, and return it. On any cache error the loader still runs, so
   * the caller always gets fresh data.
   */
  getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>;
  /**
   * Stale-while-revalidate: always return the cached value immediately if one
   * exists — even when it has gone stale — and recompute in the background so
   * the NEXT caller gets fresh data. Only the very first (cold) call blocks on
   * `loader`. This guarantees fast responses under load while keeping data at
   * most `freshSeconds` old.
   *
   * - Fresh hit  → return cached value (instant).
   * - Stale hit  → return cached value (instant) + background refresh.
   * - Cold miss  → compute once (single-flight: concurrent callers share it).
   */
  getOrSetSwr<T>(key: string, freshSeconds: number, loader: () => Promise<T>): Promise<T>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

// ──────────────────────────────────────────────
// Shared getOrSet implementation
// ──────────────────────────────────────────────
const sharedGetOrSet = async <T>(
  client: Pick<ICacheClient, 'get' | 'set'>,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> => {
  const cached = await client.get<T>(key);
  if (cached !== null && cached !== undefined) return cached;

  const fresh = await loader();
  // Fire-and-forget the write — never let caching latency block the response.
  void client.set(key, fresh, ttlSeconds);
  return fresh;
};

// ──────────────────────────────────────────────
// Shared stale-while-revalidate implementation
// ──────────────────────────────────────────────
// A stale copy is kept this many times longer than its fresh window, so an
// idle key survives long enough to keep serving instantly between requests but
// is still eventually evicted.
const SWR_HARD_TTL_MULTIPLIER = 20;

interface SwrEnvelope<T> {
  value: T;
  freshUntil: number; // epoch ms
}

// Single process, single `cache` singleton — module-level state is fine.
// De-dupes concurrent cold computes (single-flight) and concurrent background
// refreshes so a burst of requests never triggers a stampede of `loader` runs.
const inflight = new Map<string, Promise<unknown>>();
const refreshing = new Set<string>();

const computeAndStore = <T>(
  client: Pick<ICacheClient, 'set'>,
  key: string,
  freshSeconds: number,
  hardTtlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> => {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    const value = await loader();
    const envelope: SwrEnvelope<T> = {
      value,
      freshUntil: Date.now() + freshSeconds * 1000,
    };
    await client.set(key, envelope, hardTtlSeconds);
    return value;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
};

const sharedGetOrSetSwr = async <T>(
  client: Pick<ICacheClient, 'get' | 'set'>,
  key: string,
  freshSeconds: number,
  loader: () => Promise<T>,
): Promise<T> => {
  const hardTtlSeconds = freshSeconds * SWR_HARD_TTL_MULTIPLIER;
  const envelope = await client.get<SwrEnvelope<T>>(key);

  if (envelope && typeof envelope.freshUntil === 'number') {
    if (Date.now() >= envelope.freshUntil && !refreshing.has(key)) {
      // Stale — refresh in the background, but serve the stale value now.
      refreshing.add(key);
      void computeAndStore(client, key, freshSeconds, hardTtlSeconds, loader)
        .catch((err: unknown) => {
          logger.warn('Cache SWR background refresh failed', {
            key,
            message: (err as Error).message,
          });
        })
        .finally(() => refreshing.delete(key));
    }
    return envelope.value;
  }

  // Cold miss — compute once, shared across concurrent callers.
  return computeAndStore(client, key, freshSeconds, hardTtlSeconds, loader);
};

// ──────────────────────────────────────────────
// Redis implementation
// ──────────────────────────────────────────────
export class RedisCacheClient implements ICacheClient {
  private readonly client: RedisClientType;
  private connecting: Promise<void> | null = null;

  constructor() {
    this.client = createClient({
      url: config.redis.url,
      password: config.redis.password || undefined,
    });
    // Swallow connection errors — operations guard on `isReady` and fall back.
    this.client.on('error', (err: Error) => {
      logger.warn('RedisCacheClient connection error', { message: err.message });
    });
  }

  async connect(): Promise<void> {
    if (this.client.isReady) return;
    // De-dupe concurrent connect attempts.
    if (!this.connecting) {
      this.connecting = this.client
        .connect()
        .then(() => {
          logger.info('Redis cache connected');
        })
        .catch((err: Error) => {
          logger.warn('Redis cache failed to connect — falling back to misses', {
            message: err.message,
          });
        })
        .finally(() => {
          this.connecting = null;
        });
    }
    await this.connecting;
  }

  async disconnect(): Promise<void> {
    if (!this.client.isOpen) return;
    try {
      await this.client.quit();
      logger.info('Redis cache disconnected');
    } catch (err) {
      logger.warn('Redis cache disconnect error', {
        message: (err as Error).message,
      });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client.isReady) return null;
    try {
      const raw = await this.client.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (err) {
      logger.warn('RedisCacheClient.get failed', { key, message: (err as Error).message });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.client.isReady) return;
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (err) {
      logger.warn('RedisCacheClient.set failed', { key, message: (err as Error).message });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client.isReady) return;
    try {
      await this.client.del(key);
    } catch (err) {
      logger.warn('RedisCacheClient.del failed', { key, message: (err as Error).message });
    }
  }

  getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    return sharedGetOrSet(this, key, ttlSeconds, loader);
  }

  getOrSetSwr<T>(key: string, freshSeconds: number, loader: () => Promise<T>): Promise<T> {
    return sharedGetOrSetSwr(this, key, freshSeconds, loader);
  }
}

// ──────────────────────────────────────────────
// In-memory implementation (dev / single instance)
// ──────────────────────────────────────────────
export class InMemoryCacheClient implements ICacheClient {
  private readonly store: NodeCache;

  constructor() {
    this.store = new NodeCache({ useClones: false });
  }

  async connect(): Promise<void> {
    logger.info('In-memory cache initialised');
  }

  async disconnect(): Promise<void> {
    this.store.flushAll();
    this.store.close();
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.store.get<T>(key);
    return value === undefined ? null : value;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    this.store.del(key);
  }

  getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    return sharedGetOrSet(this, key, ttlSeconds, loader);
  }

  getOrSetSwr<T>(key: string, freshSeconds: number, loader: () => Promise<T>): Promise<T> {
    return sharedGetOrSetSwr(this, key, freshSeconds, loader);
  }
}

// ──────────────────────────────────────────────
// Factory + singleton
// ──────────────────────────────────────────────
export const createCacheClient = (): ICacheClient =>
  config.cache.driver === 'redis' ? new RedisCacheClient() : new InMemoryCacheClient();

export const cache: ICacheClient = createCacheClient();
