export interface RequestContext {
    ipAddress?: string;
    userAgent?: string;
}
export declare const runWithRequestContext: <T>(context: RequestContext, fn: () => T) => T;
export declare const getRequestContext: () => RequestContext | undefined;
//# sourceMappingURL=request-context.util.d.ts.map