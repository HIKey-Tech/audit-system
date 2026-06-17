BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[workflow_approval_steps] ADD [signature_id] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[workflow_approval_signed_documents] (
    [id] NVARCHAR(1000) NOT NULL,
    [approval_id] NVARCHAR(1000) NOT NULL,
    [signed_document_id] NVARCHAR(1000) NOT NULL,
    [generated_at] DATETIME2 NOT NULL CONSTRAINT [workflow_approval_signed_documents_generated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [workflow_approval_signed_documents_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_approval_signed_documents_approval_id_idx] ON [dbo].[workflow_approval_signed_documents]([approval_id]);

-- AddForeignKey
ALTER TABLE [dbo].[workflow_approval_steps] ADD CONSTRAINT [workflow_approval_steps_signature_id_fkey] FOREIGN KEY ([signature_id]) REFERENCES [dbo].[user_signatures]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_approval_signed_documents] ADD CONSTRAINT [workflow_approval_signed_documents_approval_id_fkey] FOREIGN KEY ([approval_id]) REFERENCES [dbo].[workflow_approvals]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_approval_signed_documents] ADD CONSTRAINT [workflow_approval_signed_documents_signed_document_id_fkey] FOREIGN KEY ([signed_document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
