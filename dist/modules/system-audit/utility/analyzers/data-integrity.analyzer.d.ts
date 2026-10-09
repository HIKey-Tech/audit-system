import { z } from 'zod';
import { AnalyzerDefinition } from '../../domain/entity/system-audit.entity';
declare const ParametersSchema: z.ZodObject<{
    /** Columns that together must be unique (e.g. invoice number, or vendor + invoice). */
    keyColumns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    requiredColumns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Numeric document sequence that should have no gaps (e.g. receipt or voucher number). */
    sequenceColumn: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    amountColumn: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    /** Control total from the source system or ledger, reconciled to the extract. */
    expectedTotal: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    expectedCount: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    tolerance: z.ZodDefault<z.ZodNumber>;
    dateColumn: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    periodStart: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    periodEnd: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    periodStart: string | null;
    periodEnd: string | null;
    keyColumns: string[];
    requiredColumns: string[];
    sequenceColumn: string | null;
    amountColumn: string | null;
    expectedTotal: number | null;
    expectedCount: number | null;
    tolerance: number;
    dateColumn: string | null;
}, {
    periodStart?: string | null | undefined;
    periodEnd?: string | null | undefined;
    keyColumns?: string[] | undefined;
    requiredColumns?: string[] | undefined;
    sequenceColumn?: string | null | undefined;
    amountColumn?: string | null | undefined;
    expectedTotal?: number | null | undefined;
    expectedCount?: number | null | undefined;
    tolerance?: number | undefined;
    dateColumn?: string | null | undefined;
}>;
export type DataIntegrityParameters = z.infer<typeof ParametersSchema>;
export declare const dataIntegrityAnalyzer: AnalyzerDefinition<DataIntegrityParameters>;
export {};
//# sourceMappingURL=data-integrity.analyzer.d.ts.map