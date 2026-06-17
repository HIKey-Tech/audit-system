BEGIN TRY

BEGIN TRAN;

-- DropIndex
DROP INDEX [notification_queue_status_scheduled_at_idx] ON [dbo].[notification_queue];

-- AlterTable
ALTER TABLE [dbo].[notification_queue] ADD [priority] INT NOT NULL CONSTRAINT [notification_queue_priority_df] DEFAULT 0;

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_queue_status_priority_scheduled_at_idx] ON [dbo].[notification_queue]([status], [priority], [scheduled_at]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
