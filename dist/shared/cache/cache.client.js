"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = exports.createCacheClient = exports.InMemoryCacheClient = exports.RedisCacheClient = void 0;
// src/shared/cache/cache.client.ts
//
// Cross-cutting cache abstraction. Follows the adapter + factory pattern used by
// the external clients (storage.client / oidc.client): an interface, one or more
// concrete implementations, and a factory that picks one from config.
//
// HARD RULE: the cache must never break a request. Every operation is wrapped so
// that a cache outage degrades to a miss (the caller re-computes) rather than
// throwing. This keeps the dashboard working even if Redis is down.
const redis_1 = require("redis");
const node_cache_1 = __importDefault(require("node-cache"));
const app_config_1 = require("../config/app.config");
const logger_util_1 = require("../utils/logger.util");
// ──────────────────────────────────────────────
// Shared getOrSet implementation
// ──────────────────────────────────────────────
const sharedGetOrSet = async (client, key, ttlSeconds, loader) => {
    const cached = await client.get(key);
    if (cached !== null && cached !== undefined)
        return cached;
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
// Single process, single `cache` singleton — module-level state is fine.
// De-dupes concurrent cold computes (single-flight) and concurrent background
// refreshes so a burst of requests never triggers a stampede of `loader` runs.
const inflight = new Map();
const refreshing = new Set();
const computeAndStore = (client, key, freshSeconds, hardTtlSeconds, loader) => {
    const existing = inflight.get(key);
    if (existing)
        return existing;
    const promise = (async () => {
        const value = await loader();
        const envelope = {
            value,
            freshUntil: Date.now() + freshSeconds * 1000,
        };
        await client.set(key, envelope, hardTtlSeconds);
        return value;
    })().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
};
const sharedGetOrSetSwr = async (client, key, freshSeconds, loader) => {
    const hardTtlSeconds = freshSeconds * SWR_HARD_TTL_MULTIPLIER;
    const envelope = await client.get(key);
    if (envelope && typeof envelope.freshUntil === 'number') {
        if (Date.now() >= envelope.freshUntil && !refreshing.has(key)) {
            // Stale — refresh in the background, but serve the stale value now.
            refreshing.add(key);
            void computeAndStore(client, key, freshSeconds, hardTtlSeconds, loader)
                .catch((err) => {
                logger_util_1.logger.warn('Cache SWR background refresh failed', {
                    key,
                    message: err.message,
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
class RedisCacheClient {
    client;
    connecting = null;
    constructor() {
        this.client = (0, redis_1.createClient)({
            url: app_config_1.config.redis.url,
            password: app_config_1.config.redis.password || undefined,
        });
        // Swallow connection errors — operations guard on `isReady` and fall back.
        this.client.on('error', (err) => {
            logger_util_1.logger.warn('RedisCacheClient connection error', { message: err.message });
        });
    }
    async connect() {
        if (this.client.isReady)
            return;
        // De-dupe concurrent connect attempts.
        if (!this.connecting) {
            this.connecting = this.client
                .connect()
                .then(() => {
                logger_util_1.logger.info('Redis cache connected');
            })
                .catch((err) => {
                logger_util_1.logger.warn('Redis cache failed to connect — falling back to misses', {
                    message: err.message,
                });
            })
                .finally(() => {
                this.connecting = null;
            });
        }
        await this.connecting;
    }
    async disconnect() {
        if (!this.client.isOpen)
            return;
        try {
            await this.client.quit();
            logger_util_1.logger.info('Redis cache disconnected');
        }
        catch (err) {
            logger_util_1.logger.warn('Redis cache disconnect error', {
                message: err.message,
            });
        }
    }
    async get(key) {
        if (!this.client.isReady)
            return null;
        try {
            const raw = await this.client.get(key);
            return raw === null ? null : JSON.parse(raw);
        }
        catch (err) {
            logger_util_1.logger.warn('RedisCacheClient.get failed', { key, message: err.message });
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        if (!this.client.isReady)
            return;
        try {
            await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
        }
        catch (err) {
            logger_util_1.logger.warn('RedisCacheClient.set failed', { key, message: err.message });
        }
    }
    async del(key) {
        if (!this.client.isReady)
            return;
        try {
            await this.client.del(key);
        }
        catch (err) {
            logger_util_1.logger.warn('RedisCacheClient.del failed', { key, message: err.message });
        }
    }
    getOrSet(key, ttlSeconds, loader) {
        return sharedGetOrSet(this, key, ttlSeconds, loader);
    }
    getOrSetSwr(key, freshSeconds, loader) {
        return sharedGetOrSetSwr(this, key, freshSeconds, loader);
    }
}
exports.RedisCacheClient = RedisCacheClient;
// ──────────────────────────────────────────────
// In-memory implementation (dev / single instance)
// ──────────────────────────────────────────────
class InMemoryCacheClient {
    store;
    constructor() {
        this.store = new node_cache_1.default({ useClones: false });
    }
    async connect() {
        logger_util_1.logger.info('In-memory cache initialised');
    }
    async disconnect() {
        this.store.flushAll();
        this.store.close();
    }
    async get(key) {
        const value = this.store.get(key);
        return value === undefined ? null : value;
    }
    async set(key, value, ttlSeconds) {
        this.store.set(key, value, ttlSeconds);
    }
    async del(key) {
        this.store.del(key);
    }
    getOrSet(key, ttlSeconds, loader) {
        return sharedGetOrSet(this, key, ttlSeconds, loader);
    }
    getOrSetSwr(key, freshSeconds, loader) {
        return sharedGetOrSetSwr(this, key, freshSeconds, loader);
    }
}
exports.InMemoryCacheClient = InMemoryCacheClient;
// ──────────────────────────────────────────────
// Factory + singleton
// ──────────────────────────────────────────────
const createCacheClient = () => app_config_1.config.cache.driver === 'redis' ? new RedisCacheClient() : new InMemoryCacheClient();
exports.createCacheClient = createCacheClient;
exports.cache = (0, exports.createCacheClient)();
//# sourceMappingURL=cache.client.js.map