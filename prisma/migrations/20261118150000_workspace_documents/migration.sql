BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[workspace_documents] (
    [id] NVARCHAR(1000) NOT NULL,
    [owner_id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [content] NVARCHAR(max) NOT NULL,
    [template] NVARCHAR(1000) NOT NULL CONSTRAINT [workspace_documents_template_df] DEFAULT 'blank',
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [workspace_documents_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [workspace_documents_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workspace_documents_owner_id_updated_at_idx] ON [dbo].[workspace_documents]([owner_id], [updated_at]);

-- AddForeignKey
ALTER TABLE [dbo].[workspace_documents] ADD CONSTRAINT [workspace_documents_owner_id_fkey] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
