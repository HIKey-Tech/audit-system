"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestContext = exports.runWithRequestContext = void 0;
// src/shared/utils/request-context.util.ts
const async_hooks_1 = require("async_hooks");
/**
 * Per-request context carried through async calls so deep service code (audit
 * trail writes) can record where a change came from without every caller having
 * to thread the Express request through.
 */
const storage = new async_hooks_1.AsyncLocalStorage();
const runWithRequestContext = (context, fn) => storage.run(context, fn);
exports.runWithRequestContext = runWithRequestContext;
const getRequestContext = () => storage.getStore();
exports.getRequestContext = getRequestContext;
//# sourceMappingURL=request-context.util.js.map