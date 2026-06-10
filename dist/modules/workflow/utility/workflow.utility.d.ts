/** Permission-based authorization gate (see audit.utility for rationale). */
export declare const assertHasPermission: (permissions: string[], required: string, message?: string) => void;
export declare const hoursAgo: (hours: number) => Date;
export declare const hasElapsed: (from: Date, hours: number, now?: Date) => boolean;
//# sourceMappingURL=workflow.utility.d.ts.map