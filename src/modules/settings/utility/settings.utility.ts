import {
  ReportTemplateSection,
  ReportTemplateVariable,
  WorkingPaperTemplateSection,
} from '../domain/entity/settings.entity';
import { AppError } from '../../../shared/errors/app.error';

type StoredReportSection = {
  key: string;
  title: string;
  description: string;
  include_findings?: boolean;
  includeFindings?: boolean;
};

export const toReportTemplateSections = (sections: StoredReportSection[]): ReportTemplateSection[] =>
  sections.map((section) => ({
    key: section.key,
    title: section.title,
    description: section.description,
    includeFindings: section.includeFindings ?? section.include_findings ?? false,
  }));

export const toStoredReportTemplateSections = (
  sections: ReportTemplateSection[],
): StoredReportSection[] =>
  sections.map((section) => ({
    key: section.key,
    title: section.title,
    description: section.description,
    include_findings: section.includeFindings,
  }));

export const asWorkingPaperSections = (
  value: unknown,
): WorkingPaperTemplateSection[] => parseJson(value) as WorkingPaperTemplateSection[];

export const asReportSections = (value: unknown): ReportTemplateSection[] =>
  toReportTemplateSections(parseJson(value) as StoredReportSection[]);

export const asReportVariables = (value: unknown): ReportTemplateVariable[] =>
  parseJson(value) as ReportTemplateVariable[];

export const parseNullableJson = (value: string | null): unknown | null => {
  if (value === null) return null;
  return parseJson(value);
};

export const stringifyJson = (value: unknown): string => JSON.stringify(value);

const parseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    throw AppError.internal('Stored settings JSON is invalid');
  }
};
