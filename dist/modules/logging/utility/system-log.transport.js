"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemLogTransport = void 0;
const winston_transport_1 = __importDefault(require("winston-transport"));
const prisma_client_1 = require("../../../shared/prisma/prisma.client");
const logging_enum_1 = require("../domain/enum/logging.enum");
const LEVEL = Symbol.for('level');
const MESSAGE_MAX = 2000;
const STACK_MAX = 8000;
const CONTEXT_MAX = 8000;
const REDACT_KEY = /pass(word)?|secret|token|authorization|cookie|otp|api[-_]?key|access[-_]?key|credential/i;
// Winston/transport internals and fields stored in their own columns.
const OMIT_KEYS = new Set(['level', 'message', 'timestamp', 'service', 'stack', 'err', 'error']);
const truncate = (value, max) => value.length > max ? `${value.slice(0, max)}…` : value;
const redact = (value, depth = 0) => {
    if (depth > 4)
        return '[depth]';
    if (value instanceof Error)
        return { name: value.name, message: value.message };
    if (Array.isArray(value))
        return value.slice(0, 20).map((v) => redact(v, depth + 1));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [
            k,
            REDACT_KEY.test(k) ? '[redacted]' : redact(v, depth + 1),
        ]));
    }
    return value;
};
const findError = (info) => {
    for (const key of ['err', 'error']) {
        if (info[key] instanceof Error)
            return info[key];
    }
    return undefined;
};
const sourceOf = (info) => {
    if (typeof info.jobKey === 'string')
        return logging_enum_1.SystemLogSource.Job;
    if (typeof info.path === 'string' || typeof info.requestId === 'string')
        return logging_enum_1.SystemLogSource.Http;
    return logging_enum_1.SystemLogSource.App;
};
/**
 * Persists application exceptions (`error` level) to `system_logs` so auditors
 * can review system exceptions alongside the audit trail. Writes are
 * fire-and-forget and failures are swallowed: this transport must never log
 * through Winston itself (that would recurse) or block the request path.
 */
class SystemLogTransport extends winston_transport_1.default {
    constructor() {
        super({ level: 'error' });
    }
    log(info, callback) {
        setImmediate(() => this.emit('logged', info));
        const record = info;
        if (info[LEVEL] !== 'error') {
            callback();
            return;
        }
        const err = findError(record);
        const stack = (typeof record.stack === 'string' ? record.stack : undefined) ?? err?.stack;
        const context = Object.fromEntries(Object.entries(record).filter(([k]) => !OMIT_KEYS.has(k)));
        prisma_client_1.prisma.system_Log
            .create({
            data: {
                level: 'error',
                message: truncate(String(record.message ?? err?.message ?? 'Unknown error'), MESSAGE_MAX),
                source: sourceOf(record),
                error_name: err?.name ?? null,
                path: typeof record.path === 'string' ? truncate(record.path, 500) : null,
                request_id: typeof record.requestId === 'string' ? record.requestId : null,
                stack: stack ? truncate(stack, STACK_MAX) : null,
                context: Object.keys(context).length > 0
                    ? truncate(JSON.stringify(redact(context)), CONTEXT_MAX)
                    : null,
            },
        })
            .catch(() => undefined)
            .finally(callback);
    }
}
exports.SystemLogTransport = SystemLogTransport;
//# sourceMappingURL=system-log.transport.js.map