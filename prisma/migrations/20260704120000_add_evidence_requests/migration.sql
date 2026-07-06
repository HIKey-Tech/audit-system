BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[audit_evidence] ADD [request_id] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[audit_evidence_requests] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max),
    [due_date] DATETIME2,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_evidence_requests_status_df] DEFAULT 'open',
    [return_reason] NVARCHAR(max),
    [requested_by_id] NVARCHAR(1000) NOT NULL,
    [assigned_to_id] NVARCHAR(1000) NOT NULL,
    [fulfilled_at] DATETIME2,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_evidence_requests_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [audit_evidence_requests_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_evidence_request_id_idx] ON [dbo].[audit_evidence]([request_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_evidence_requests_engagement_id_idx] ON [dbo].[audit_evidence_requests]([engagement_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_evidence_requests_assigned_to_id_status_idx] ON [dbo].[audit_evidence_requests]([assigned_to_id], [status]);

-- AddForeignKey
ALTER TABLE [dbo].[audit_evidence] ADD CONSTRAINT [audit_evidence_request_id_fkey] FOREIGN KEY ([request_id]) REFERENCES [dbo].[audit_evidence_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_evidence_requests] ADD CONSTRAINT [audit_evidence_requests_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_evidence_requests] ADD CONSTRAINT [audit_evidence_requests_requested_by_id_fkey] FOREIGN KEY ([requested_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_evidence_requests] ADD CONSTRAINT [audit_evidence_requests_assigned_to_id_fkey] FOREIGN KEY ([assigned_to_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
