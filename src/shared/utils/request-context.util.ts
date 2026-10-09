// src/shared/utils/request-context.util.ts
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Per-request context carried through async calls so deep service code (audit
 * trail writes) can record where a change came from without every caller having
 * to thread the Express request through.
 */
const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, fn: () => T): T =>
  storage.run(context, fn);

export const getRequestContext = (): RequestContext | undefined => storage.getStore();
