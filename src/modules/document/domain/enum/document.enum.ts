// src/modules/document/domain/enum/document.enum.ts
export enum StorageProvider {
  LOCAL = 'local',
  AZURE_BLOB = 'azure_blob',
  AWS_S3 = 'aws_s3',
}

export enum TemplateCategory {
  WORKING_PAPER = 'working_paper',
  AUDIT_REPORT = 'audit_report',
  FINDING = 'finding',
  RISK_ASSESSMENT = 'risk_assessment',
  CHECKLIST = 'checklist',
  POLICY = 'policy',
  PROCEDURE = 'procedure',
}
