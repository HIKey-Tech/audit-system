BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[notification_queue] (
    [id] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [notification_queue_status_df] DEFAULT 'pending',
    [attempts] INT NOT NULL CONSTRAINT [notification_queue_attempts_df] DEFAULT 0,
    [max_attempts] INT NOT NULL CONSTRAINT [notification_queue_max_attempts_df] DEFAULT 3,
    [last_error] NVARCHAR(max),
    [scheduled_at] DATETIME2 NOT NULL CONSTRAINT [notification_queue_scheduled_at_df] DEFAULT CURRENT_TIMESTAMP,
    [processed_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [notification_queue_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [notification_queue_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_queue_status_scheduled_at_idx] ON [dbo].[notification_queue]([status], [scheduled_at]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
