BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[audit_findings] ADD [checklist_id] NVARCHAR(1000),
[risk_id] NVARCHAR(1000);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_findings_checklist_id_idx] ON [dbo].[audit_findings]([checklist_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_findings_risk_id_idx] ON [dbo].[audit_findings]([risk_id]);

-- AddForeignKey
ALTER TABLE [dbo].[audit_findings] ADD CONSTRAINT [audit_findings_checklist_id_fkey] FOREIGN KEY ([checklist_id]) REFERENCES [dbo].[audit_checklists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_findings] ADD CONSTRAINT [audit_findings_risk_id_fkey] FOREIGN KEY ([risk_id]) REFERENCES [dbo].[risk_register]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
