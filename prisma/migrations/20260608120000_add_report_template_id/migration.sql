BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[audit_reports] ADD [template_id] NVARCHAR(1000);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_reports_template_id_idx] ON [dbo].[audit_reports]([template_id]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
