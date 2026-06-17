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
export declare class RedisCacheClient implements ICacheClient {
    private readonly client;
    private connecting;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
    del(key: string): Promise<void>;
    getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>;
    getOrSetSwr<T>(key: string, freshSeconds: number, loader: () => Promise<T>): Promise<T>;
}
export declare class InMemoryCacheClient implements ICacheClient {
    private readonly store;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
    del(key: string): Promise<void>;
    getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>;
    getOrSetSwr<T>(key: string, freshSeconds: number, loader: () => Promise<T>): Promise<T>;
}
export declare const createCacheClient: () => ICacheClient;
export declare const cache: ICacheClient;
//# sourceMappingURL=cache.client.d.ts.map