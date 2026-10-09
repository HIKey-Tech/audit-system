import Transport from 'winston-transport';
/**
 * Persists application exceptions (`error` level) to `system_logs` so auditors
 * can review system exceptions alongside the audit trail. Writes are
 * fire-and-forget and failures are swallowed: this transport must never log
 * through Winston itself (that would recurse) or block the request path.
 */
export declare class SystemLogTransport extends Transport {
    constructor();
    log(info: Record<string | symbol, unknown>, callback: () => void): void;
}
//# sourceMappingURL=system-log.transport.d.ts.map