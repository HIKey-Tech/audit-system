BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[audit_engagements] ADD [planned_hours] INT;

-- CreateTable
CREATE TABLE [dbo].[audit_time_entries] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [entry_date] DATETIME2 NOT NULL,
    [hours] DECIMAL(5,2) NOT NULL,
    [description] NVARCHAR(500),
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_time_entries_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_time_entries_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_time_entries_engagement_id_idx] ON [dbo].[audit_time_entries]([engagement_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_time_entries_user_id_idx] ON [dbo].[audit_time_entries]([user_id]);

-- AddForeignKey
ALTER TABLE [dbo].[audit_time_entries] ADD CONSTRAINT [audit_time_entries_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_time_entries] ADD CONSTRAINT [audit_time_entries_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
