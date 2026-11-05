BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[projectplus_entity_links] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [customer_type] NVARCHAR(1000) NOT NULL,
    [reference_code] NVARCHAR(1000) NOT NULL,
    [full_name] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000),
    [entity_sub_type] NVARCHAR(1000),
    [rc_number] NVARCHAR(1000),
    [tin] NVARCHAR(1000),
    [last_status] NVARCHAR(1000),
    [last_synced_at] DATETIME2,
    [is_active] BIT NOT NULL CONSTRAINT [projectplus_entity_links_is_active_df] DEFAULT 1,
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [projectplus_entity_links_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [projectplus_entity_links_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [projectplus_entity_links_engagement_id_customer_type_reference_code_key] UNIQUE NONCLUSTERED ([engagement_id],[customer_type],[reference_code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [projectplus_entity_links_engagement_id_is_active_idx] ON [dbo].[projectplus_entity_links]([engagement_id], [is_active]);

-- AddForeignKey
ALTER TABLE [dbo].[projectplus_entity_links] ADD CONSTRAINT [projectplus_entity_links_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[projectplus_entity_links] ADD CONSTRAINT [projectplus_entity_links_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
