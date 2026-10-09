import { z } from 'zod';
import { AnalyzerDefinition } from '../../domain/entity/system-audit.entity';
declare const ParametersSchema: z.ZodObject<{
    /** Longest acceptable time between two successful backups of one system. */
    maxHoursBetweenBackups: z.ZodDefault<z.ZodNumber>;
    /** Each system needs a successful restore test at least this recently. */
    restoreTestMaxAgeDays: z.ZodDefault<z.ZodNumber>;
    requireRestoreTests: z.ZodDefault<z.ZodBoolean>;
    /** Default recovery-time objective when a restore row carries no target. Null disables RTO checks. */
    rtoMinutes: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    maxHoursBetweenBackups: number;
    restoreTestMaxAgeDays: number;
    requireRestoreTests: boolean;
    rtoMinutes: number | null;
}, {
    maxHoursBetweenBackups?: number | undefined;
    restoreTestMaxAgeDays?: number | undefined;
    requireRestoreTests?: boolean | undefined;
    rtoMinutes?: number | null | undefined;
}>;
export type BackupLogParameters = z.infer<typeof ParametersSchema>;
export declare const backupLogAnalyzer: AnalyzerDefinition<BackupLogParameters>;
export {};
//# sourceMappingURL=backup-log.analyzer.d.ts.map