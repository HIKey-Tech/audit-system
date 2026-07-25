BEGIN TRY

BEGIN TRAN;

-- REM-2: chain-of-custody hash for uploaded evidence/documents
ALTER TABLE [dbo].[documents] ADD [content_sha256] NVARCHAR(1000);

-- REM-3: tamper-evident audit log (rolling hash chain)
ALTER TABLE [dbo].[audit_logs] ADD [prev_hash] NVARCHAR(1000), [row_hash] NVARCHAR(1000);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
