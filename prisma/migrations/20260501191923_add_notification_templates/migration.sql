BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[notification_templates] (
    [id] NVARCHAR(1000) NOT NULL,
    [event_key] NVARCHAR(1000) NOT NULL,
    [channel] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [subject] NVARCHAR(1000),
    [body] NVARCHAR(max) NOT NULL,
    [description] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [notification_templates_is_active_df] DEFAULT 1,
    [created_by_id] NVARCHAR(1000),
    [updated_by_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [notification_templates_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [notification_templates_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [notification_templates_event_key_channel_key] UNIQUE NONCLUSTERED ([event_key],[channel])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_templates_event_key_idx] ON [dbo].[notification_templates]([event_key]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_templates_channel_idx] ON [dbo].[notification_templates]([channel]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_templates_is_active_idx] ON [dbo].[notification_templates]([is_active]);

-- AddForeignKey
ALTER TABLE [dbo].[notification_templates] ADD CONSTRAINT [notification_templates_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[notification_templates] ADD CONSTRAINT [notification_templates_updated_by_id_fkey] FOREIGN KEY ([updated_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
