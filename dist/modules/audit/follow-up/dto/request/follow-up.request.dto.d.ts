import { z } from 'zod';
import { VerificationStatus } from '../../../domain/enum/audit.enum';
export declare const ManagementResponseRequestSchema: z.ZodObject<{
    managementResponse: z.ZodString;
}, "strip", z.ZodTypeAny, {
    managementResponse: string;
}, {
    managementResponse: string;
}>;
export declare const RemediationEvidenceRequestSchema: z.ZodObject<{
    evidenceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    evidenceId: string;
}, {
    evidenceId: string;
}>;
export declare const VerifyRemediationRequestSchema: z.ZodObject<{
    verificationStatus: z.ZodEnum<[VerificationStatus.Verified, VerificationStatus.Rejected]>;
    verificationNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    verificationStatus: VerificationStatus.Verified | VerificationStatus.Rejected;
    verificationNotes?: string | undefined;
}, {
    verificationStatus: VerificationStatus.Verified | VerificationStatus.Rejected;
    verificationNotes?: string | undefined;
}>;
export type ManagementResponseRequestDto = z.infer<typeof ManagementResponseRequestSchema>;
export type RemediationEvidenceRequestDto = z.infer<typeof RemediationEvidenceRequestSchema>;
export type VerifyRemediationRequestDto = z.infer<typeof VerifyRemediationRequestSchema>;
//# sourceMappingURL=follow-up.request.dto.d.ts.map