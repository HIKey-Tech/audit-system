BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[audit_findings] ADD [area_universe_id] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[audit_engagement_auditees] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_engagement_auditees_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_engagement_auditees_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_engagement_auditees_engagement_id_user_id_key] UNIQUE NONCLUSTERED ([engagement_id],[user_id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_engagement_areas] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [universe_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_engagement_areas_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_engagement_areas_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_engagement_areas_engagement_id_universe_id_key] UNIQUE NONCLUSTERED ([engagement_id],[universe_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_findings_area_universe_id_idx] ON [dbo].[audit_findings]([area_universe_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_engagement_auditees_user_id_idx] ON [dbo].[audit_engagement_auditees]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_engagement_areas_universe_id_idx] ON [dbo].[audit_engagement_areas]([universe_id]);

-- AddForeignKey
ALTER TABLE [dbo].[audit_findings] ADD CONSTRAINT [audit_findings_area_universe_id_fkey] FOREIGN KEY ([area_universe_id]) REFERENCES [dbo].[audit_universe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_engagement_auditees] ADD CONSTRAINT [audit_engagement_auditees_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_engagement_auditees] ADD CONSTRAINT [audit_engagement_auditees_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_engagement_areas] ADD CONSTRAINT [audit_engagement_areas_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_engagement_areas] ADD CONSTRAINT [audit_engagement_areas_universe_id_fkey] FOREIGN KEY ([universe_id]) REFERENCES [dbo].[audit_universe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
