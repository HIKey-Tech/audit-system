BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[compliance_frameworks] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max),
    [category] NVARCHAR(1000) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [compliance_frameworks_is_active_df] DEFAULT 1,
    [created_by_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [compliance_frameworks_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [compliance_frameworks_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [compliance_frameworks_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[compliance_controls] (
    [id] NVARCHAR(1000) NOT NULL,
    [framework_id] NVARCHAR(1000) NOT NULL,
    [control_reference] NVARCHAR(1000) NOT NULL,
    [control_description] NVARCHAR(max) NOT NULL,
    [test_procedure] NVARCHAR(max) NOT NULL,
    [audit_type] NVARCHAR(1000) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [compliance_controls_is_active_df] DEFAULT 1,
    [created_by_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [compliance_controls_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [compliance_controls_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [compliance_controls_framework_id_control_reference_key] UNIQUE NONCLUSTERED ([framework_id],[control_reference])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [compliance_frameworks_is_active_idx] ON [dbo].[compliance_frameworks]([is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [compliance_controls_framework_id_idx] ON [dbo].[compliance_controls]([framework_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [compliance_controls_audit_type_idx] ON [dbo].[compliance_controls]([audit_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [compliance_controls_is_active_idx] ON [dbo].[compliance_controls]([is_active]);

-- AddForeignKey
ALTER TABLE [dbo].[compliance_controls] ADD CONSTRAINT [compliance_controls_framework_id_fkey] FOREIGN KEY ([framework_id]) REFERENCES [dbo].[compliance_frameworks]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
