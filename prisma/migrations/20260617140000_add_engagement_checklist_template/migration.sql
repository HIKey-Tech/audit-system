BEGIN TRY

BEGIN TRAN;

-- Per-engagement checklist control snapshot chosen at engagement creation.
-- Idempotent so development databases that already have the column are not
-- forced into a destructive reset.
IF COL_LENGTH('dbo.audit_engagements', 'checklist_template') IS NULL
BEGIN
    ALTER TABLE [dbo].[audit_engagements] ADD [checklist_template] NVARCHAR(max);
END

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
