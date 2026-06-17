BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[workflow_request_actions] ADD [signature_id] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[user_signatures] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [document_id] NVARCHAR(1000) NOT NULL,
    [kind] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [user_signatures_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [user_signatures_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[workflow_request_signed_documents] (
    [id] NVARCHAR(1000) NOT NULL,
    [request_id] NVARCHAR(1000) NOT NULL,
    [source_document_id] NVARCHAR(1000),
    [signed_document_id] NVARCHAR(1000) NOT NULL,
    [generated_at] DATETIME2 NOT NULL CONSTRAINT [workflow_request_signed_documents_generated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [workflow_request_signed_documents_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [user_signatures_user_id_idx] ON [dbo].[user_signatures]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_request_signed_documents_request_id_idx] ON [dbo].[workflow_request_signed_documents]([request_id]);

-- AddForeignKey
ALTER TABLE [dbo].[workflow_request_actions] ADD CONSTRAINT [workflow_request_actions_signature_id_fkey] FOREIGN KEY ([signature_id]) REFERENCES [dbo].[user_signatures]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_signatures] ADD CONSTRAINT [user_signatures_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_signatures] ADD CONSTRAINT [user_signatures_document_id_fkey] FOREIGN KEY ([document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_request_signed_documents] ADD CONSTRAINT [workflow_request_signed_documents_request_id_fkey] FOREIGN KEY ([request_id]) REFERENCES [dbo].[workflow_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_request_signed_documents] ADD CONSTRAINT [workflow_request_signed_documents_source_document_id_fkey] FOREIGN KEY ([source_document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_request_signed_documents] ADD CONSTRAINT [workflow_request_signed_documents_signed_document_id_fkey] FOREIGN KEY ([signed_document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
