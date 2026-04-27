BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[audit_universe] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max),
    [category] NVARCHAR(1000) NOT NULL,
    [owner_id] NVARCHAR(1000) NOT NULL,
    [risk_score] DECIMAL(5,2),
    [last_audited_at] DATETIME2,
    [audit_frequency] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_universe_status_df] DEFAULT 'active',
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_universe_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_universe_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_plans] (
    [id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [year] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_plans_status_df] DEFAULT 'draft',
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [approved_by_id] NVARCHAR(1000),
    [approved_at] DATETIME2,
    [rejection_reason] NVARCHAR(max),
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_plans_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_plans_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_plan_items] (
    [id] NVARCHAR(1000) NOT NULL,
    [plan_id] NVARCHAR(1000) NOT NULL,
    [universe_id] NVARCHAR(1000) NOT NULL,
    [audit_type] NVARCHAR(1000) NOT NULL,
    [planned_start_date] DATETIME2 NOT NULL,
    [planned_end_date] DATETIME2 NOT NULL,
    [priority] NVARCHAR(1000) NOT NULL,
    [engagement_created] BIT NOT NULL CONSTRAINT [audit_plan_items_engagement_created_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_plan_items_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_plan_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_engagements] (
    [id] NVARCHAR(1000) NOT NULL,
    [reference_number] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [universe_id] NVARCHAR(1000) NOT NULL,
    [plan_item_id] NVARCHAR(1000),
    [audit_type] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_engagements_status_df] DEFAULT 'planned',
    [priority] NVARCHAR(1000) NOT NULL,
    [lead_auditor_id] NVARCHAR(1000) NOT NULL,
    [audit_manager_id] NVARCHAR(1000) NOT NULL,
    [auditee_id] NVARCHAR(1000) NOT NULL,
    [planned_start_date] DATETIME2 NOT NULL,
    [planned_end_date] DATETIME2 NOT NULL,
    [actual_start_date] DATETIME2,
    [actual_end_date] DATETIME2,
    [sla_deadline] DATETIME2 NOT NULL,
    [is_adhoc] BIT NOT NULL CONSTRAINT [audit_engagements_is_adhoc_df] DEFAULT 0,
    [adhoc_reason] NVARCHAR(max),
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_engagements_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_engagements_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_engagements_reference_number_key] UNIQUE NONCLUSTERED ([reference_number])
);

-- CreateTable
CREATE TABLE [dbo].[audit_working_papers] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [content] NVARCHAR(max) NOT NULL,
    [version_number] INT NOT NULL CONSTRAINT [audit_working_papers_version_number_df] DEFAULT 1,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_working_papers_status_df] DEFAULT 'draft',
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [reviewed_by_id] NVARCHAR(1000),
    [rejection_reason] NVARCHAR(max),
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_working_papers_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_working_papers_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_evidence] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [working_paper_id] NVARCHAR(1000),
    [finding_id] NVARCHAR(1000),
    [document_id] NVARCHAR(1000) NOT NULL,
    [file_name] NVARCHAR(1000) NOT NULL,
    [file_type] NVARCHAR(1000) NOT NULL,
    [uploaded_by_id] NVARCHAR(1000) NOT NULL,
    [is_disputed] BIT NOT NULL CONSTRAINT [audit_evidence_is_disputed_df] DEFAULT 0,
    [dispute_reason] NVARCHAR(max),
    [uploaded_at] DATETIME2 NOT NULL CONSTRAINT [audit_evidence_uploaded_at_df] DEFAULT CURRENT_TIMESTAMP,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_evidence_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_evidence_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_findings] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [working_paper_id] NVARCHAR(1000),
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [category] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(1000) NOT NULL,
    [root_cause] NVARCHAR(max) NOT NULL,
    [risk_implication] NVARCHAR(max) NOT NULL,
    [recommendation] NVARCHAR(max) NOT NULL,
    [auditee_id] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_findings_status_df] DEFAULT 'open',
    [due_date] DATETIME2 NOT NULL,
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [closed_by_id] NVARCHAR(1000),
    [closed_at] DATETIME2,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_findings_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_findings_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_reports] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [executive_summary] NVARCHAR(max) NOT NULL,
    [scope] NVARCHAR(max) NOT NULL,
    [methodology] NVARCHAR(max) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_reports_status_df] DEFAULT 'draft',
    [version_number] INT NOT NULL CONSTRAINT [audit_reports_version_number_df] DEFAULT 1,
    [document_id] NVARCHAR(1000),
    [issued_at] DATETIME2,
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_reports_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_reports_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_reports_engagement_id_key] UNIQUE NONCLUSTERED ([engagement_id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_follow_ups] (
    [id] NVARCHAR(1000) NOT NULL,
    [finding_id] NVARCHAR(1000) NOT NULL,
    [management_response] NVARCHAR(max),
    [management_response_by_id] NVARCHAR(1000),
    [management_response_at] DATETIME2,
    [remediation_evidence_id] NVARCHAR(1000),
    [verification_status] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_follow_ups_verification_status_df] DEFAULT 'pending',
    [verified_by_id] NVARCHAR(1000),
    [verified_at] DATETIME2,
    [verification_notes] NVARCHAR(max),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_follow_ups_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_follow_ups_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_follow_ups_finding_id_key] UNIQUE NONCLUSTERED ([finding_id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_checklists] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [audit_type] NVARCHAR(1000) NOT NULL,
    [control_reference] NVARCHAR(1000) NOT NULL,
    [control_description] NVARCHAR(max) NOT NULL,
    [test_procedure] NVARCHAR(max) NOT NULL,
    [result] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_checklists_result_df] DEFAULT 'not_tested',
    [notes] NVARCHAR(max),
    [evidence_id] NVARCHAR(1000),
    [tested_by_id] NVARCHAR(1000),
    [tested_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_checklists_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_checklists_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_universe_category_idx] ON [dbo].[audit_universe]([category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_universe_status_idx] ON [dbo].[audit_universe]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_universe_owner_id_idx] ON [dbo].[audit_universe]([owner_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_universe_risk_score_idx] ON [dbo].[audit_universe]([risk_score]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_plans_status_idx] ON [dbo].[audit_plans]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_plans_year_idx] ON [dbo].[audit_plans]([year]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_plans_created_by_id_idx] ON [dbo].[audit_plans]([created_by_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_plan_items_plan_id_idx] ON [dbo].[audit_plan_items]([plan_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_plan_items_universe_id_idx] ON [dbo].[audit_plan_items]([universe_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_plan_items_audit_type_idx] ON [dbo].[audit_plan_items]([audit_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_plan_items_priority_idx] ON [dbo].[audit_plan_items]([priority]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_engagements_status_idx] ON [dbo].[audit_engagements]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_engagements_audit_type_idx] ON [dbo].[audit_engagements]([audit_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_engagements_lead_auditor_id_idx] ON [dbo].[audit_engagements]([lead_auditor_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_engagements_audit_manager_id_idx] ON [dbo].[audit_engagements]([audit_manager_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_engagements_auditee_id_idx] ON [dbo].[audit_engagements]([auditee_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_engagements_sla_deadline_idx] ON [dbo].[audit_engagements]([sla_deadline]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_engagements_reference_number_idx] ON [dbo].[audit_engagements]([reference_number]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_working_papers_engagement_id_idx] ON [dbo].[audit_working_papers]([engagement_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_working_papers_status_idx] ON [dbo].[audit_working_papers]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_working_papers_created_by_id_idx] ON [dbo].[audit_working_papers]([created_by_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_evidence_engagement_id_idx] ON [dbo].[audit_evidence]([engagement_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_evidence_working_paper_id_idx] ON [dbo].[audit_evidence]([working_paper_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_evidence_finding_id_idx] ON [dbo].[audit_evidence]([finding_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_evidence_uploaded_by_id_idx] ON [dbo].[audit_evidence]([uploaded_by_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_findings_engagement_id_idx] ON [dbo].[audit_findings]([engagement_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_findings_severity_idx] ON [dbo].[audit_findings]([severity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_findings_status_idx] ON [dbo].[audit_findings]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_findings_auditee_id_idx] ON [dbo].[audit_findings]([auditee_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_findings_due_date_idx] ON [dbo].[audit_findings]([due_date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_findings_category_idx] ON [dbo].[audit_findings]([category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_reports_engagement_id_idx] ON [dbo].[audit_reports]([engagement_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_reports_status_idx] ON [dbo].[audit_reports]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_reports_created_by_id_idx] ON [dbo].[audit_reports]([created_by_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_follow_ups_finding_id_idx] ON [dbo].[audit_follow_ups]([finding_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_follow_ups_verification_status_idx] ON [dbo].[audit_follow_ups]([verification_status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_checklists_engagement_id_idx] ON [dbo].[audit_checklists]([engagement_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_checklists_audit_type_idx] ON [dbo].[audit_checklists]([audit_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_checklists_result_idx] ON [dbo].[audit_checklists]([result]);

-- AddForeignKey
ALTER TABLE [dbo].[audit_universe] ADD CONSTRAINT [audit_universe_owner_id_fkey] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_universe] ADD CONSTRAINT [audit_universe_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_plans] ADD CONSTRAINT [audit_plans_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_plans] ADD CONSTRAINT [audit_plans_approved_by_id_fkey] FOREIGN KEY ([approved_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_plan_items] ADD CONSTRAINT [audit_plan_items_plan_id_fkey] FOREIGN KEY ([plan_id]) REFERENCES [dbo].[audit_plans]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_plan_items] ADD CONSTRAINT [audit_plan_items_universe_id_fkey] FOREIGN KEY ([universe_id]) REFERENCES [dbo].[audit_universe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_engagements] ADD CONSTRAINT [audit_engagements_universe_id_fkey] FOREIGN KEY ([universe_id]) REFERENCES [dbo].[audit_universe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_engagements] ADD CONSTRAINT [audit_engagements_plan_item_id_fkey] FOREIGN KEY ([plan_item_id]) REFERENCES [dbo].[audit_plan_items]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_engagements] ADD CONSTRAINT [audit_engagements_lead_auditor_id_fkey] FOREIGN KEY ([lead_auditor_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_engagements] ADD CONSTRAINT [audit_engagements_audit_manager_id_fkey] FOREIGN KEY ([audit_manager_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_engagements] ADD CONSTRAINT [audit_engagements_auditee_id_fkey] FOREIGN KEY ([auditee_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_engagements] ADD CONSTRAINT [audit_engagements_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_working_papers] ADD CONSTRAINT [audit_working_papers_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_working_papers] ADD CONSTRAINT [audit_working_papers_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_working_papers] ADD CONSTRAINT [audit_working_papers_reviewed_by_id_fkey] FOREIGN KEY ([reviewed_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_evidence] ADD CONSTRAINT [audit_evidence_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_evidence] ADD CONSTRAINT [audit_evidence_working_paper_id_fkey] FOREIGN KEY ([working_paper_id]) REFERENCES [dbo].[audit_working_papers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_evidence] ADD CONSTRAINT [audit_evidence_finding_id_fkey] FOREIGN KEY ([finding_id]) REFERENCES [dbo].[audit_findings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_evidence] ADD CONSTRAINT [audit_evidence_document_id_fkey] FOREIGN KEY ([document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_evidence] ADD CONSTRAINT [audit_evidence_uploaded_by_id_fkey] FOREIGN KEY ([uploaded_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_findings] ADD CONSTRAINT [audit_findings_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_findings] ADD CONSTRAINT [audit_findings_working_paper_id_fkey] FOREIGN KEY ([working_paper_id]) REFERENCES [dbo].[audit_working_papers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_findings] ADD CONSTRAINT [audit_findings_auditee_id_fkey] FOREIGN KEY ([auditee_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_findings] ADD CONSTRAINT [audit_findings_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_findings] ADD CONSTRAINT [audit_findings_closed_by_id_fkey] FOREIGN KEY ([closed_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_reports] ADD CONSTRAINT [audit_reports_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_reports] ADD CONSTRAINT [audit_reports_document_id_fkey] FOREIGN KEY ([document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_reports] ADD CONSTRAINT [audit_reports_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_follow_ups] ADD CONSTRAINT [audit_follow_ups_finding_id_fkey] FOREIGN KEY ([finding_id]) REFERENCES [dbo].[audit_findings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_follow_ups] ADD CONSTRAINT [audit_follow_ups_management_response_by_id_fkey] FOREIGN KEY ([management_response_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_follow_ups] ADD CONSTRAINT [audit_follow_ups_remediation_evidence_id_fkey] FOREIGN KEY ([remediation_evidence_id]) REFERENCES [dbo].[audit_evidence]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_follow_ups] ADD CONSTRAINT [audit_follow_ups_verified_by_id_fkey] FOREIGN KEY ([verified_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_checklists] ADD CONSTRAINT [audit_checklists_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_checklists] ADD CONSTRAINT [audit_checklists_evidence_id_fkey] FOREIGN KEY ([evidence_id]) REFERENCES [dbo].[audit_evidence]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_checklists] ADD CONSTRAINT [audit_checklists_tested_by_id_fkey] FOREIGN KEY ([tested_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
