BEGIN TRY

BEGIN TRAN;

-- Record the audit_plans.description column in migration history.
-- Some development databases already have this column, so keep the migration
-- idempotent to avoid forcing a destructive reset.
IF COL_LENGTH('dbo.audit_plans', 'description') IS NULL
BEGIN
    ALTER TABLE [dbo].[audit_plans] ADD [description] NVARCHAR(max);
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
