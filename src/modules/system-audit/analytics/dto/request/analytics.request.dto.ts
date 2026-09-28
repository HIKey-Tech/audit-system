import { z } from 'zod';
import { ExportFormatSchema } from '../../../../../shared/utils/tabular-export.util';
import { FindingSeverity, SELECTABLE_FINDING_CATEGORIES } from '../../../../audit/domain/enum/audit.enum';
import {
  AnalysisSource,
  AnalysisType,
  ExceptionDisposition,
  ExceptionSeverity,
  RunReviewStatus,
  RunTrigger,
} from '../../../domain/enum/system-audit.enum';

/** Multipart form fields arrive as text; structured ones are sent as JSON strings. */
const jsonField = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be valid JSON' });
        return z.NEVER;
      }
    })
    .pipe(schema);

const ColumnMappingSchema = z.record(z.string(), z.string().nullable());
const ParametersSchema = z.record(z.string(), z.unknown());

export const PreviewExtractSchema = z.object({
  analysisType: z.nativeEnum(AnalysisType),
});

export const RunUploadAnalysisSchema = z.object({
  analysisType: z.nativeEnum(AnalysisType),
  systemName: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200).optional(),
  engagementId: z.string().uuid().optional(),
  securityTestId: z.string().uuid().optional(),
  /** Configuration runs: compare against this baseline instead of the system's current one. */
  baselineRunId: z.string().uuid().optional(),
  dateOrder: z.enum(['dmy', 'mdy']).default('dmy'),
  mapping: jsonField(ColumnMappingSchema).optional(),
  parameters: jsonField(ParametersSchema).optional(),
});

export const RunLiveAnalysisSchema = z.object({
  analysisType: z.nativeEnum(AnalysisType),
  source: z.enum([AnalysisSource.Iams, AnalysisSource.EntraId, AnalysisSource.Imoc]),
  title: z.string().trim().min(1).max(200).optional(),
  engagementId: z.string().uuid().optional(),
  /** Look-back window for event and incident sources. */
  days: z.number().int().min(1).max(365).default(30),
  parameters: ParametersSchema.optional(),
});

export const RunListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  analysisType: z.nativeEnum(AnalysisType).optional(),
  source: z.nativeEnum(AnalysisSource).optional(),
  trigger: z.nativeEnum(RunTrigger).optional(),
  reviewStatus: z.nativeEnum(RunReviewStatus).optional(),
  engagementId: z.string().uuid().optional(),
  securityTestId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export const ExceptionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  severity: z.nativeEnum(ExceptionSeverity).optional(),
  disposition: z.nativeEnum(ExceptionDisposition).optional(),
  ruleCode: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export const ExceptionExportQuerySchema = z.object({ format: ExportFormatSchema });

export const DispositionExceptionsSchema = z
  .object({
    exceptionIds: z.array(z.string().uuid()).min(1).max(500),
    disposition: z.enum([ExceptionDisposition.Confirmed, ExceptionDisposition.FalsePositive, ExceptionDisposition.Explained, ExceptionDisposition.Open]),
    note: z.string().trim().max(4000).optional(),
  })
  .refine((d) => d.disposition === ExceptionDisposition.Confirmed || d.disposition === ExceptionDisposition.Open || Boolean(d.note), {
    message: 'Explain why the exception is a false positive or already explained',
    path: ['note'],
  });

export const RaiseFindingSchema = z.object({
  exceptionIds: z.array(z.string().uuid()).min(1).max(100),
  /** Required when the run is not linked to an engagement. */
  engagementId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000).optional(),
  category: z.enum(SELECTABLE_FINDING_CATEGORIES).default(SELECTABLE_FINDING_CATEGORIES[0]),
  severity: z.nativeEnum(FindingSeverity),
  rootCause: z.string().trim().min(1).max(10_000),
  riskImplication: z.string().trim().min(1).max(10_000),
  recommendation: z.string().trim().min(1).max(10_000),
  auditeeId: z.string().uuid(),
  dueDate: z.string().datetime(),
});

export const CompleteReviewSchema = z.object({
  note: z.string().trim().max(4000).optional(),
});

export type PreviewExtractDto = z.infer<typeof PreviewExtractSchema>;
export type RunUploadAnalysisDto = z.infer<typeof RunUploadAnalysisSchema>;
export type RunLiveAnalysisDto = z.infer<typeof RunLiveAnalysisSchema>;
export type RunListQueryDto = z.infer<typeof RunListQuerySchema>;
export type ExceptionListQueryDto = z.infer<typeof ExceptionListQuerySchema>;
export type ExceptionExportQueryDto = z.infer<typeof ExceptionExportQuerySchema>;
export type DispositionExceptionsDto = z.infer<typeof DispositionExceptionsSchema>;
export type RaiseFindingDto = z.infer<typeof RaiseFindingSchema>;
export type CompleteReviewDto = z.infer<typeof CompleteReviewSchema>;
