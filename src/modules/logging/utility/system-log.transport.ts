import Transport from 'winston-transport';
import { prisma } from '../../../shared/prisma/prisma.client';
import { SystemLogSource } from '../domain/enum/logging.enum';

const LEVEL = Symbol.for('level');
const MESSAGE_MAX = 2000;
const STACK_MAX = 8000;
const CONTEXT_MAX = 8000;
const REDACT_KEY = /pass(word)?|secret|token|authorization|cookie|otp|api[-_]?key|access[-_]?key|credential/i;
// Winston/transport internals and fields stored in their own columns.
const OMIT_KEYS = new Set(['level', 'message', 'timestamp', 'service', 'stack', 'err', 'error']);

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max)}…` : value;

const redact = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return '[depth]';
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        REDACT_KEY.test(k) ? '[redacted]' : redact(v, depth + 1),
      ]),
    );
  }
  return value;
};

const findError = (info: Record<string, unknown>): Error | undefined => {
  for (const key of ['err', 'error']) {
    if (info[key] instanceof Error) return info[key] as Error;
  }
  return undefined;
};

const sourceOf = (info: Record<string, unknown>): SystemLogSource => {
  if (typeof info.jobKey === 'string') return SystemLogSource.Job;
  if (typeof info.path === 'string' || typeof info.requestId === 'string') return SystemLogSource.Http;
  return SystemLogSource.App;
};

/**
 * Persists application exceptions (`error` level) to `system_logs` so auditors
 * can review system exceptions alongside the audit trail. Writes are
 * fire-and-forget and failures are swallowed: this transport must never log
 * through Winston itself (that would recurse) or block the request path.
 */
export class SystemLogTransport extends Transport {
  constructor() {
    super({ level: 'error' });
  }

  override log(info: Record<string | symbol, unknown>, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    const record = info as Record<string, unknown>;
    if (info[LEVEL] !== 'error') {
      callback();
      return;
    }

    const err = findError(record);
    const stack = (typeof record.stack === 'string' ? record.stack : undefined) ?? err?.stack;
    const context = Object.fromEntries(
      Object.entries(record).filter(([k]) => !OMIT_KEYS.has(k)),
    );

    prisma.system_Log
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
