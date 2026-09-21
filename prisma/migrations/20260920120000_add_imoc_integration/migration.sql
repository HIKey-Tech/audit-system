BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[imoc_ticket_links] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [working_paper_id] NVARCHAR(1000),
    [finding_id] NVARCHAR(1000),
    [order_id] NVARCHAR(1000) NOT NULL,
    [order_number] NVARCHAR(1000) NOT NULL,
    [order_name] NVARCHAR(1000),
    [model_id] NVARCHAR(1000),
    [model_name] NVARCHAR(1000),
    [model_type] NVARCHAR(1000),
    [last_status] NVARCHAR(1000),
    [last_sla_status] NVARCHAR(1000),
    [last_step_name] NVARCHAR(1000),
    [last_step_sequence] INT,
    [last_synced_at] DATETIME2,
    [last_sync_error] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [imoc_ticket_links_is_active_df] DEFAULT 1,
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [imoc_ticket_links_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [imoc_ticket_links_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [imoc_ticket_links_engagement_id_order_id_key] UNIQUE NONCLUSTERED ([engagement_id], [order_id])
);

-- CreateTable
CREATE TABLE [dbo].[imoc_ticket_snapshots] (
    [id] NVARCHAR(1000) NOT NULL,
    [imoc_ticket_link_id] NVARCHAR(1000) NOT NULL,
    [audit_evidence_id] NVARCHAR(1000),
    [status] NVARCHAR(1000),
    [sla_status] NVARCHAR(1000),
    [snapshot_json] NVARCHAR(max) NOT NULL,
    [payload_sha256] NVARCHAR(64) NOT NULL,
    [source_retrieved_at] DATETIME2 NOT NULL,
    [captured_by_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [imoc_ticket_snapshots_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [imoc_ticket_snapshots_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_ticket_links_engagement_id_is_active_idx] ON [dbo].[imoc_ticket_links]([engagement_id], [is_active]);
CREATE NONCLUSTERED INDEX [imoc_ticket_links_order_number_idx] ON [dbo].[imoc_ticket_links]([order_number]);
CREATE NONCLUSTERED INDEX [imoc_ticket_links_last_status_idx] ON [dbo].[imoc_ticket_links]([last_status]);
CREATE NONCLUSTERED INDEX [imoc_ticket_snapshots_imoc_ticket_link_id_created_at_idx] ON [dbo].[imoc_ticket_snapshots]([imoc_ticket_link_id], [created_at]);
CREATE NONCLUSTERED INDEX [imoc_ticket_snapshots_audit_evidence_id_idx] ON [dbo].[imoc_ticket_snapshots]([audit_evidence_id]);

-- AddForeignKey
ALTER TABLE [dbo].[imoc_ticket_links] ADD CONSTRAINT [imoc_ticket_links_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[imoc_ticket_links] ADD CONSTRAINT [imoc_ticket_links_working_paper_id_fkey] FOREIGN KEY ([working_paper_id]) REFERENCES [dbo].[audit_working_papers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[imoc_ticket_links] ADD CONSTRAINT [imoc_ticket_links_finding_id_fkey] FOREIGN KEY ([finding_id]) REFERENCES [dbo].[audit_findings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[imoc_ticket_links] ADD CONSTRAINT [imoc_ticket_links_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[imoc_ticket_snapshots] ADD CONSTRAINT [imoc_ticket_snapshots_imoc_ticket_link_id_fkey] FOREIGN KEY ([imoc_ticket_link_id]) REFERENCES [dbo].[imoc_ticket_links]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[imoc_ticket_snapshots] ADD CONSTRAINT [imoc_ticket_snapshots_audit_evidence_id_fkey] FOREIGN KEY ([audit_evidence_id]) REFERENCES [dbo].[audit_evidence]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[imoc_ticket_snapshots] ADD CONSTRAINT [imoc_ticket_snapshots_captured_by_id_fkey] FOREIGN KEY ([captured_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
