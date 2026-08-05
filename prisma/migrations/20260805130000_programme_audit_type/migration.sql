BEGIN TRY

BEGIN TRAN;

-- An audit programme is now scoped to a single audit type. This migration only
-- ADDS the column; the backfill and the drop of audit_plan_items.audit_type
-- follow in 20260805130100_programme_audit_type_backfill.
--
-- They must be separate migrations: SQL Server compiles a whole batch before
-- running any of it, and Prisma submits each migration.sql as one batch, so a
-- column added by ALTER TABLE here is not visible to statements in the same
-- file (error 207, "Invalid column name").

IF COL_LENGTH('dbo.audit_plans', 'audit_type') IS NULL
    ALTER TABLE [dbo].[audit_plans] ADD [audit_type] NVARCHAR(1000) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
