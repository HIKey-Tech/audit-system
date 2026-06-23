BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[audit_finding_responders] (
    [id] NVARCHAR(1000) NOT NULL,
    [finding_id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_finding_responders_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_finding_responders_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_finding_responders_finding_id_user_id_key] UNIQUE NONCLUSTERED ([finding_id],[user_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_finding_responders_user_id_idx] ON [dbo].[audit_finding_responders]([user_id]);

-- AddForeignKey
ALTER TABLE [dbo].[audit_finding_responders] ADD CONSTRAINT [audit_finding_responders_finding_id_fkey] FOREIGN KEY ([finding_id]) REFERENCES [dbo].[audit_findings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_finding_responders] ADD CONSTRAINT [audit_finding_responders_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
