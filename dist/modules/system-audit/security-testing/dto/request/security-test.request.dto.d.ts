import { z } from 'zod';
import { SecurityTestProviderType, SecurityTestStatus, SecurityTestType } from '../../../domain/enum/system-audit.enum';
export declare const CreateSecurityTestSchema: z.ZodEffects<z.ZodObject<{
    title: z.ZodString;
    testType: z.ZodNativeEnum<typeof SecurityTestType>;
    engagementId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    provider: z.ZodString;
    providerType: z.ZodDefault<z.ZodNativeEnum<typeof SecurityTestProviderType>>;
    scope: z.ZodString;
    rulesOfEngagement: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    plannedStart: z.ZodString;
    plannedEnd: z.ZodString;
    /** Defaults to the creator. */
    coordinatorId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
} & {
    assetIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    scope: string;
    provider: string;
    testType: SecurityTestType;
    providerType: SecurityTestProviderType;
    plannedStart: string;
    plannedEnd: string;
    notes?: string | null | undefined;
    engagementId?: string | null | undefined;
    rulesOfEngagement?: string | null | undefined;
    coordinatorId?: string | undefined;
    assetIds?: string[] | undefined;
}, {
    title: string;
    scope: string;
    provider: string;
    testType: SecurityTestType;
    plannedStart: string;
    plannedEnd: string;
    notes?: string | null | undefined;
    engagementId?: string | null | undefined;
    providerType?: SecurityTestProviderType | undefined;
    rulesOfEngagement?: string | null | undefined;
    coordinatorId?: string | undefined;
    assetIds?: string[] | undefined;
}>, {
    title: string;
    scope: string;
    provider: string;
    testType: SecurityTestType;
    providerType: SecurityTestProviderType;
    plannedStart: string;
    plannedEnd: string;
    notes?: string | null | undefined;
    engagementId?: string | null | undefined;
    rulesOfEngagement?: string | null | undefined;
    coordinatorId?: string | undefined;
    assetIds?: string[] | undefined;
}, {
    title: string;
    scope: string;
    provider: string;
    testType: SecurityTestType;
    plannedStart: string;
    plannedEnd: string;
    notes?: string | null | undefined;
    engagementId?: string | null | undefined;
    providerType?: SecurityTestProviderType | undefined;
    rulesOfEngagement?: string | null | undefined;
    coordinatorId?: string | undefined;
    assetIds?: string[] | undefined;
}>;
export declare const UpdateSecurityTestSchema: z.ZodEffects<z.ZodObject<Omit<{
    title: z.ZodOptional<z.ZodString>;
    testType: z.ZodOptional<z.ZodNativeEnum<typeof SecurityTestType>>;
    engagementId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    provider: z.ZodOptional<z.ZodString>;
    providerType: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof SecurityTestProviderType>>>;
    scope: z.ZodOptional<z.ZodString>;
    rulesOfEngagement: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    plannedStart: z.ZodOptional<z.ZodString>;
    plannedEnd: z.ZodOptional<z.ZodString>;
    coordinatorId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, "providerType"> & {
    providerType: z.ZodOptional<z.ZodNativeEnum<typeof SecurityTestProviderType>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    scope?: string | undefined;
    notes?: string | null | undefined;
    provider?: string | undefined;
    engagementId?: string | null | undefined;
    testType?: SecurityTestType | undefined;
    providerType?: SecurityTestProviderType | undefined;
    rulesOfEngagement?: string | null | undefined;
    plannedStart?: string | undefined;
    plannedEnd?: string | undefined;
    coordinatorId?: string | undefined;
}, {
    title?: string | undefined;
    scope?: string | undefined;
    notes?: string | null | undefined;
    provider?: string | undefined;
    engagementId?: string | null | undefined;
    testType?: SecurityTestType | undefined;
    providerType?: SecurityTestProviderType | undefined;
    rulesOfEngagement?: string | null | undefined;
    plannedStart?: string | undefined;
    plannedEnd?: string | undefined;
    coordinatorId?: string | undefined;
}>, {
    title?: string | undefined;
    scope?: string | undefined;
    notes?: string | null | undefined;
    provider?: string | undefined;
    engagementId?: string | null | undefined;
    testType?: SecurityTestType | undefined;
    providerType?: SecurityTestProviderType | undefined;
    rulesOfEngagement?: string | null | undefined;
    plannedStart?: string | undefined;
    plannedEnd?: string | undefined;
    coordinatorId?: string | undefined;
}, {
    title?: string | undefined;
    scope?: string | undefined;
    notes?: string | null | undefined;
    provider?: string | undefined;
    engagementId?: string | null | undefined;
    testType?: SecurityTestType | undefined;
    providerType?: SecurityTestProviderType | undefined;
    rulesOfEngagement?: string | null | undefined;
    plannedStart?: string | undefined;
    plannedEnd?: string | undefined;
    coordinatorId?: string | undefined;
}>;
export declare const ChangeSecurityTestStatusSchema: z.ZodObject<{
    status: z.ZodEnum<[SecurityTestStatus.InProgress, SecurityTestStatus.Reporting, SecurityTestStatus.Remediation, SecurityTestStatus.Closed, SecurityTestStatus.Cancelled]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: SecurityTestStatus.InProgress | SecurityTestStatus.Reporting | SecurityTestStatus.Remediation | SecurityTestStatus.Closed | SecurityTestStatus.Cancelled;
    note?: string | undefined;
}, {
    status: SecurityTestStatus.InProgress | SecurityTestStatus.Reporting | SecurityTestStatus.Remediation | SecurityTestStatus.Closed | SecurityTestStatus.Cancelled;
    note?: string | undefined;
}>;
export declare const AuthoriseSecurityTestSchema: z.ZodObject<{
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    note?: string | undefined;
}, {
    note?: string | undefined;
}>;
export declare const SecurityTestAssetsSchema: z.ZodObject<{
    assetIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    assetIds: string[];
}, {
    assetIds: string[];
}>;
export declare const SecurityTestListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof SecurityTestStatus>>;
    testType: z.ZodOptional<z.ZodNativeEnum<typeof SecurityTestType>>;
    engagementId: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    search?: string | undefined;
    status?: SecurityTestStatus | undefined;
    engagementId?: string | undefined;
    testType?: SecurityTestType | undefined;
}, {
    search?: string | undefined;
    status?: SecurityTestStatus | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    engagementId?: string | undefined;
    testType?: SecurityTestType | undefined;
}>;
export type CreateSecurityTestDto = z.infer<typeof CreateSecurityTestSchema>;
export type UpdateSecurityTestDto = z.infer<typeof UpdateSecurityTestSchema>;
export type ChangeSecurityTestStatusDto = z.infer<typeof ChangeSecurityTestStatusSchema>;
export type AuthoriseSecurityTestDto = z.infer<typeof AuthoriseSecurityTestSchema>;
export type SecurityTestAssetsDto = z.infer<typeof SecurityTestAssetsSchema>;
export type SecurityTestListQueryDto = z.infer<typeof SecurityTestListQuerySchema>;
//# sourceMappingURL=security-test.request.dto.d.ts.map