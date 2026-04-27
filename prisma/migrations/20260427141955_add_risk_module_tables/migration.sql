BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[risk_categories] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [risk_categories_is_active_df] DEFAULT 1,
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [risk_categories_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [risk_categories_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [risk_categories_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[risk_register] (
    [id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [category_id] NVARCHAR(1000) NOT NULL,
    [owner_id] NVARCHAR(1000) NOT NULL,
    [likelihood] INT NOT NULL,
    [impact] INT NOT NULL,
    [current_score] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [risk_register_status_df] DEFAULT 'open',
    [last_assessed_at] DATETIME2,
    [universe_id] NVARCHAR(1000),
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [risk_register_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [risk_register_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[risk_assessments] (
    [id] NVARCHAR(1000) NOT NULL,
    [risk_id] NVARCHAR(1000) NOT NULL,
    [likelihood] INT NOT NULL,
    [impact] INT NOT NULL,
    [score] INT NOT NULL,
    [notes] NVARCHAR(max),
    [assessed_by_id] NVARCHAR(1000) NOT NULL,
    [assessed_at] DATETIME2 NOT NULL CONSTRAINT [risk_assessments_assessed_at_df] DEFAULT CURRENT_TIMESTAMP,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [risk_assessments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [risk_assessments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [risk_register_category_id_idx] ON [dbo].[risk_register]([category_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [risk_register_owner_id_idx] ON [dbo].[risk_register]([owner_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [risk_register_status_idx] ON [dbo].[risk_register]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [risk_register_current_score_idx] ON [dbo].[risk_register]([current_score]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [risk_register_universe_id_idx] ON [dbo].[risk_register]([universe_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [risk_assessments_risk_id_idx] ON [dbo].[risk_assessments]([risk_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [risk_assessments_assessed_by_id_idx] ON [dbo].[risk_assessments]([assessed_by_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [risk_assessments_assessed_at_idx] ON [dbo].[risk_assessments]([assessed_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [risk_assessments_score_idx] ON [dbo].[risk_assessments]([score]);

-- AddForeignKey
ALTER TABLE [dbo].[risk_categories] ADD CONSTRAINT [risk_categories_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[risk_register] ADD CONSTRAINT [risk_register_category_id_fkey] FOREIGN KEY ([category_id]) REFERENCES [dbo].[risk_categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[risk_register] ADD CONSTRAINT [risk_register_owner_id_fkey] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[risk_register] ADD CONSTRAINT [risk_register_universe_id_fkey] FOREIGN KEY ([universe_id]) REFERENCES [dbo].[audit_universe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[risk_register] ADD CONSTRAINT [risk_register_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[risk_assessments] ADD CONSTRAINT [risk_assessments_risk_id_fkey] FOREIGN KEY ([risk_id]) REFERENCES [dbo].[risk_register]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[risk_assessments] ADD CONSTRAINT [risk_assessments_assessed_by_id_fkey] FOREIGN KEY ([assessed_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
