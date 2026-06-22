BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[user_roles] ADD [source] NVARCHAR(1000) NOT NULL CONSTRAINT [user_roles_source_df] DEFAULT 'manual';

-- CreateTable
CREATE TABLE [dbo].[directory_group_mappings] (
    [id] NVARCHAR(1000) NOT NULL,
    [ad_group_id] NVARCHAR(1000) NOT NULL,
    [ad_group_name] NVARCHAR(1000) NOT NULL,
    [role_id] NVARCHAR(1000) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [directory_group_mappings_is_active_df] DEFAULT 1,
    [created_by] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [directory_group_mappings_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [directory_group_mappings_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [directory_group_mappings_ad_group_id_role_id_key] UNIQUE NONCLUSTERED ([ad_group_id],[role_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [directory_group_mappings_ad_group_id_idx] ON [dbo].[directory_group_mappings]([ad_group_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [directory_group_mappings_is_active_idx] ON [dbo].[directory_group_mappings]([is_active]);

-- AddForeignKey
ALTER TABLE [dbo].[directory_group_mappings] ADD CONSTRAINT [directory_group_mappings_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[roles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
