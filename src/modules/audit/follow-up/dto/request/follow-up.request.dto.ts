import { z } from 'zod';
import { VerificationStatus } from '../../../domain/enum/audit.enum';

export const ManagementResponseRequestSchema = z.object({
  managementResponse: z.string().min(1).max(10000),
});

export const RemediationEvidenceRequestSchema = z.object({
  evidenceId: z.string().uuid(),
});

export const VerifyRemediationRequestSchema = z.object({
  verificationStatus: z.enum([VerificationStatus.Verified, VerificationStatus.Rejected]),
  verificationNotes: z.string().max(5000).optional(),
});

export type ManagementResponseRequestDto = z.infer<typeof ManagementResponseRequestSchema>;
export type RemediationEvidenceRequestDto = z.infer<typeof RemediationEvidenceRequestSchema>;
export type VerifyRemediationRequestDto = z.infer<typeof VerifyRemediationRequestSchema>;
