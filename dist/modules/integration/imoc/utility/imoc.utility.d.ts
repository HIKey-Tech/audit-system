import { z } from 'zod';
import { AppError } from '../../../../shared/errors/app.error';
import { ImocModelSummary, ImocRuleCriteria, ImocTicket, ImocTicketSearch } from '../domain/entity/imoc.entity';
/** Maps a vendor response into the allow-listed ticket projection. */
export declare const normalizeImocTicket: (value: unknown) => ImocTicket;
/** Model detail can be useful context, but field definitions may be sensitive. */
export declare const normalizeImocModel: (value: unknown) => ImocModelSummary;
/**
 * Snapshot capture is intentionally much smaller than the raw ticket detail.
 * This lets audit retain a defensible point-in-time record without persisting
 * arbitrary IMOC form, secret, privacy, or dynamic-reference fields.
 */
export declare const buildSafeImocSnapshot: (ticket: ImocTicket) => Record<string, unknown>;
export declare const hashSnapshot: (snapshot: Record<string, unknown>) => string;
export declare const classifyImocNetworkError: (err: unknown) => AppError;
export declare const classifyImocUpstreamError: (upstreamCode: string | number, upstreamMsg?: unknown, isSingleTicketLookup?: boolean) => AppError;
export declare const ImocRuleCriteriaSchema: z.ZodObject<{
    orderStatus: z.ZodOptional<z.ZodArray<z.ZodEnum<["processing", "dismissed", "reback", "completed", "suspend", "scrapped", "draft"]>, "many">>;
    slaStatus: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    modelIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    modelNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    modelTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    orderSources: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    nameContains: z.ZodOptional<z.ZodString>;
    currentUsers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    createdWithinDays: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    orderStatus?: ("processing" | "draft" | "completed" | "dismissed" | "reback" | "suspend" | "scrapped")[] | undefined;
    slaStatus?: string[] | undefined;
    modelIds?: string[] | undefined;
    modelNames?: string[] | undefined;
    modelTypes?: string[] | undefined;
    orderSources?: string[] | undefined;
    nameContains?: string | undefined;
    currentUsers?: string[] | undefined;
    createdWithinDays?: number | undefined;
}, {
    orderStatus?: ("processing" | "draft" | "completed" | "dismissed" | "reback" | "suspend" | "scrapped")[] | undefined;
    slaStatus?: string[] | undefined;
    modelIds?: string[] | undefined;
    modelNames?: string[] | undefined;
    modelTypes?: string[] | undefined;
    orderSources?: string[] | undefined;
    nameContains?: string | undefined;
    currentUsers?: string[] | undefined;
    createdWithinDays?: number | undefined;
}>;
export declare const countRuleCombinations: (criteria: ImocRuleCriteria) => number;
export declare const validateRuleCriteria: (criteria: unknown) => ImocRuleCriteria;
export declare const formatImocDate: (date: Date, utc?: boolean) => string;
export declare const formatImocDateRange: (lookbackDays?: number, utc?: boolean, now?: Date) => {
    beginStartDate: string;
    beginEndDate: string;
};
export declare const parseImocDate: (dateStr: string | null | undefined, utc?: boolean) => Date | null;
export declare const buildUpstreamQueries: (criteria: ImocRuleCriteria, lookbackDays?: number, utc?: boolean, now?: Date) => ImocTicketSearch[];
export declare const matchesRuleCriteria: (ticket: ImocTicket, criteria: ImocRuleCriteria, now?: Date) => boolean;
export declare const MODEL_TYPE_CATEGORY_MAP: Record<string, string>;
export declare const resolveTicketCategory: (matchedRules: Array<{
    priority: number;
    category: string | null;
}>, ticket: ImocTicket) => string;
export declare const hashImocTicket: (ticket: ImocTicket) => string;
//# sourceMappingURL=imoc.utility.d.ts.map