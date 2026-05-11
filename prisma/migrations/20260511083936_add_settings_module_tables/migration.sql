BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[working_paper_templates] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [audit_type] NVARCHAR(1000) NOT NULL,
    [sections] NVARCHAR(max) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [working_paper_templates_is_active_df] DEFAULT 1,
    [is_default] BIT NOT NULL CONSTRAINT [working_paper_templates_is_default_df] DEFAULT 0,
    [created_by_id] NVARCHAR(1000),
    [updated_by_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [working_paper_templates_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [working_paper_templates_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [working_paper_templates_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[report_templates] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [sections] NVARCHAR(max) NOT NULL,
    [header_config] NVARCHAR(max),
    [footer_config] NVARCHAR(max),
    [signature_config] NVARCHAR(max),
    [available_variables] NVARCHAR(max) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [report_templates_is_active_df] DEFAULT 1,
    [is_default] BIT NOT NULL CONSTRAINT [report_templates_is_default_df] DEFAULT 0,
    [created_by_id] NVARCHAR(1000),
    [updated_by_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [report_templates_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [report_templates_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [report_templates_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[system_config] (
    [id] NVARCHAR(1000) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(max),
    [description] NVARCHAR(1000),
    [is_public] BIT NOT NULL CONSTRAINT [system_config_is_public_df] DEFAULT 0,
    [updated_by_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [system_config_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [system_config_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [system_config_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [working_paper_templates_audit_type_idx] ON [dbo].[working_paper_templates]([audit_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [working_paper_templates_is_active_idx] ON [dbo].[working_paper_templates]([is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [working_paper_templates_is_default_idx] ON [dbo].[working_paper_templates]([is_default]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [report_templates_is_active_idx] ON [dbo].[report_templates]([is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [report_templates_is_default_idx] ON [dbo].[report_templates]([is_default]);

-- AddForeignKey
ALTER TABLE [dbo].[working_paper_templates] ADD CONSTRAINT [working_paper_templates_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[working_paper_templates] ADD CONSTRAINT [working_paper_templates_updated_by_id_fkey] FOREIGN KEY ([updated_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[report_templates] ADD CONSTRAINT [report_templates_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[report_templates] ADD CONSTRAINT [report_templates_updated_by_id_fkey] FOREIGN KEY ([updated_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_config] ADD CONSTRAINT [system_config_updated_by_id_fkey] FOREIGN KEY ([updated_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
