BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[system_audit_runs] (
    [id] NVARCHAR(1000) NOT NULL,
    [reference] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [analysis_type] NVARCHAR(1000) NOT NULL,
    [source] NVARCHAR(1000) NOT NULL,
    [system_name] NVARCHAR(1000) NOT NULL,
    [trigger] NVARCHAR(1000) NOT NULL CONSTRAINT [system_audit_runs_trigger_df] DEFAULT 'manual',
    [engagement_id] NVARCHAR(1000),
    [security_test_id] NVARCHAR(1000),
    [evidence_id] NVARCHAR(1000),
    [document_id] NVARCHAR(1000),
    [file_name] NVARCHAR(1000),
    [content_sha256] NVARCHAR(64),
    [record_count] INT NOT NULL CONSTRAINT [system_audit_runs_record_count_df] DEFAULT 0,
    [exception_count] INT NOT NULL CONSTRAINT [system_audit_runs_exception_count_df] DEFAULT 0,
    [parameters] NVARCHAR(max),
    [summary] NVARCHAR(max),
    [snapshot] NVARCHAR(max),
    [is_baseline] BIT NOT NULL CONSTRAINT [system_audit_runs_is_baseline_df] DEFAULT 0,
    [baseline_run_id] NVARCHAR(1000),
    [review_status] NVARCHAR(1000) NOT NULL CONSTRAINT [system_audit_runs_review_status_df] DEFAULT 'open',
    [review_note] NVARCHAR(max),
    [reviewed_by_id] NVARCHAR(1000),
    [reviewed_at] DATETIME2,
    [created_by_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [system_audit_runs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [system_audit_runs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [system_audit_runs_reference_key] UNIQUE NONCLUSTERED ([reference])
);

-- CreateTable
CREATE TABLE [dbo].[system_audit_exceptions] (
    [id] NVARCHAR(1000) NOT NULL,
    [run_id] NVARCHAR(1000) NOT NULL,
    [rule_code] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(500) NOT NULL,
    [record_ref] NVARCHAR(500),
    [details] NVARCHAR(max),
    [disposition] NVARCHAR(1000) NOT NULL CONSTRAINT [system_audit_exceptions_disposition_df] DEFAULT 'open',
    [disposition_note] NVARCHAR(max),
    [disposed_by_id] NVARCHAR(1000),
    [disposed_at] DATETIME2,
    [finding_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [system_audit_exceptions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [system_audit_exceptions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[access_review_items] (
    [id] NVARCHAR(1000) NOT NULL,
    [run_id] NVARCHAR(1000) NOT NULL,
    [account_id] NVARCHAR(300) NOT NULL,
    [display_name] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [department] NVARCHAR(1000),
    [account_status] NVARCHAR(1000),
    [is_privileged] BIT NOT NULL CONSTRAINT [access_review_items_is_privileged_df] DEFAULT 0,
    [last_login_at] DATETIME2,
    [entitlements] NVARCHAR(max) NOT NULL,
    [flags] NVARCHAR(max),
    [decision] NVARCHAR(1000) NOT NULL CONSTRAINT [access_review_items_decision_df] DEFAULT 'pending',
    [decision_note] NVARCHAR(max),
    [decided_by_id] NVARCHAR(1000),
    [decided_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [access_review_items_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [access_review_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[security_tests] (
    [id] NVARCHAR(1000) NOT NULL,
    [reference] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [test_type] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [security_tests_status_df] DEFAULT 'planned',
    [engagement_id] NVARCHAR(1000),
    [provider] NVARCHAR(1000) NOT NULL,
    [provider_type] NVARCHAR(1000) NOT NULL CONSTRAINT [security_tests_provider_type_df] DEFAULT 'internal',
    [scope] NVARCHAR(max) NOT NULL,
    [rules_of_engagement] NVARCHAR(max),
    [planned_start] DATETIME2 NOT NULL,
    [planned_end] DATETIME2 NOT NULL,
    [actual_start] DATETIME2,
    [actual_end] DATETIME2,
    [coordinator_id] NVARCHAR(1000) NOT NULL,
    [authorised_by_id] NVARCHAR(1000),
    [authorised_at] DATETIME2,
    [report_document_id] NVARCHAR(1000),
    [notes] NVARCHAR(max),
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [security_tests_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [security_tests_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [security_tests_reference_key] UNIQUE NONCLUSTERED ([reference])
);

-- CreateTable
CREATE TABLE [dbo].[security_test_assets] (
    [id] NVARCHAR(1000) NOT NULL,
    [test_id] NVARCHAR(1000) NOT NULL,
    [asset_id] NVARCHAR(1000) NOT NULL,
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [security_test_assets_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [security_test_assets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [security_test_assets_test_id_asset_id_key] UNIQUE NONCLUSTERED ([test_id],[asset_id])
);

-- CreateTable
CREATE TABLE [dbo].[system_documents] (
    [id] NVARCHAR(1000) NOT NULL,
    [document_id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [doc_type] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max),
    [version_label] NVARCHAR(1000),
    [owner_id] NVARCHAR(1000) NOT NULL,
    [universe_id] NVARCHAR(1000),
    [asset_id] NVARCHAR(1000),
    [vendor] NVARCHAR(1000),
    [effective_date] DATETIME2,
    [review_due_date] DATETIME2,
    [expiry_date] DATETIME2,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [system_documents_status_df] DEFAULT 'active',
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [system_documents_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [system_documents_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_runs_analysis_type_created_at_idx] ON [dbo].[system_audit_runs]([analysis_type], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_runs_source_idx] ON [dbo].[system_audit_runs]([source]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_runs_system_name_idx] ON [dbo].[system_audit_runs]([system_name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_runs_engagement_id_idx] ON [dbo].[system_audit_runs]([engagement_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_runs_security_test_id_idx] ON [dbo].[system_audit_runs]([security_test_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_runs_review_status_idx] ON [dbo].[system_audit_runs]([review_status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_runs_trigger_created_at_idx] ON [dbo].[system_audit_runs]([trigger], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_exceptions_run_id_severity_idx] ON [dbo].[system_audit_exceptions]([run_id], [severity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_exceptions_run_id_disposition_idx] ON [dbo].[system_audit_exceptions]([run_id], [disposition]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_exceptions_rule_code_idx] ON [dbo].[system_audit_exceptions]([rule_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_audit_exceptions_finding_id_idx] ON [dbo].[system_audit_exceptions]([finding_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [access_review_items_run_id_decision_idx] ON [dbo].[access_review_items]([run_id], [decision]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [access_review_items_run_id_is_privileged_idx] ON [dbo].[access_review_items]([run_id], [is_privileged]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [security_tests_status_idx] ON [dbo].[security_tests]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [security_tests_test_type_idx] ON [dbo].[security_tests]([test_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [security_tests_engagement_id_idx] ON [dbo].[security_tests]([engagement_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [security_tests_planned_start_idx] ON [dbo].[security_tests]([planned_start]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [security_test_assets_asset_id_idx] ON [dbo].[security_test_assets]([asset_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_documents_doc_type_idx] ON [dbo].[system_documents]([doc_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_documents_universe_id_idx] ON [dbo].[system_documents]([universe_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_documents_asset_id_idx] ON [dbo].[system_documents]([asset_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_documents_owner_id_idx] ON [dbo].[system_documents]([owner_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_documents_review_due_date_idx] ON [dbo].[system_documents]([review_due_date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_documents_expiry_date_idx] ON [dbo].[system_documents]([expiry_date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_documents_status_idx] ON [dbo].[system_documents]([status]);

-- AddForeignKey
ALTER TABLE [dbo].[system_audit_runs] ADD CONSTRAINT [system_audit_runs_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_audit_runs] ADD CONSTRAINT [system_audit_runs_security_test_id_fkey] FOREIGN KEY ([security_test_id]) REFERENCES [dbo].[security_tests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_audit_runs] ADD CONSTRAINT [system_audit_runs_evidence_id_fkey] FOREIGN KEY ([evidence_id]) REFERENCES [dbo].[audit_evidence]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_audit_runs] ADD CONSTRAINT [system_audit_runs_document_id_fkey] FOREIGN KEY ([document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_audit_runs] ADD CONSTRAINT [system_audit_runs_baseline_run_id_fkey] FOREIGN KEY ([baseline_run_id]) REFERENCES [dbo].[system_audit_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_audit_runs] ADD CONSTRAINT [system_audit_runs_reviewed_by_id_fkey] FOREIGN KEY ([reviewed_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_audit_runs] ADD CONSTRAINT [system_audit_runs_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_audit_exceptions] ADD CONSTRAINT [system_audit_exceptions_run_id_fkey] FOREIGN KEY ([run_id]) REFERENCES [dbo].[system_audit_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_audit_exceptions] ADD CONSTRAINT [system_audit_exceptions_disposed_by_id_fkey] FOREIGN KEY ([disposed_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_audit_exceptions] ADD CONSTRAINT [system_audit_exceptions_finding_id_fkey] FOREIGN KEY ([finding_id]) REFERENCES [dbo].[audit_findings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[access_review_items] ADD CONSTRAINT [access_review_items_run_id_fkey] FOREIGN KEY ([run_id]) REFERENCES [dbo].[system_audit_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[access_review_items] ADD CONSTRAINT [access_review_items_decided_by_id_fkey] FOREIGN KEY ([decided_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[security_tests] ADD CONSTRAINT [security_tests_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[security_tests] ADD CONSTRAINT [security_tests_coordinator_id_fkey] FOREIGN KEY ([coordinator_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[security_tests] ADD CONSTRAINT [security_tests_authorised_by_id_fkey] FOREIGN KEY ([authorised_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[security_tests] ADD CONSTRAINT [security_tests_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[security_tests] ADD CONSTRAINT [security_tests_report_document_id_fkey] FOREIGN KEY ([report_document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[security_test_assets] ADD CONSTRAINT [security_test_assets_test_id_fkey] FOREIGN KEY ([test_id]) REFERENCES [dbo].[security_tests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[security_test_assets] ADD CONSTRAINT [security_test_assets_asset_id_fkey] FOREIGN KEY ([asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[security_test_assets] ADD CONSTRAINT [security_test_assets_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_documents] ADD CONSTRAINT [system_documents_document_id_fkey] FOREIGN KEY ([document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_documents] ADD CONSTRAINT [system_documents_owner_id_fkey] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_documents] ADD CONSTRAINT [system_documents_universe_id_fkey] FOREIGN KEY ([universe_id]) REFERENCES [dbo].[audit_universe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_documents] ADD CONSTRAINT [system_documents_asset_id_fkey] FOREIGN KEY ([asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_documents] ADD CONSTRAINT [system_documents_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
