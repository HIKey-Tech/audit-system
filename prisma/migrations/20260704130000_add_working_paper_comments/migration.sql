BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[audit_working_paper_comments] (
    [id] NVARCHAR(1000) NOT NULL,
    [working_paper_id] NVARCHAR(1000) NOT NULL,
    [author_id] NVARCHAR(1000) NOT NULL,
    [body] NVARCHAR(max) NOT NULL,
    [resolved_at] DATETIME2,
    [resolved_by_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_working_paper_comments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_working_paper_comments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_working_paper_comments_working_paper_id_idx] ON [dbo].[audit_working_paper_comments]([working_paper_id]);

-- AddForeignKey
ALTER TABLE [dbo].[audit_working_paper_comments] ADD CONSTRAINT [audit_working_paper_comments_working_paper_id_fkey] FOREIGN KEY ([working_paper_id]) REFERENCES [dbo].[audit_working_papers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_working_paper_comments] ADD CONSTRAINT [audit_working_paper_comments_author_id_fkey] FOREIGN KEY ([author_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_working_paper_comments] ADD CONSTRAINT [audit_working_paper_comments_resolved_by_id_fkey] FOREIGN KEY ([resolved_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
