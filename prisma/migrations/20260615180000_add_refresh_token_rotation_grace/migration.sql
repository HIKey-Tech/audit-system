BEGIN TRY

BEGIN TRAN;

-- Rotation-grace support for refresh tokens. `replaced_by` records the successor
-- token's id when a token is rotated out by a normal refresh, so reuse-detection
-- can forgive a benign concurrent refresh (e.g. two browser tabs sharing one
-- cookie) instead of revoking every session and forcing a re-login.

ALTER TABLE [dbo].[refresh_tokens] ADD [replaced_by] NVARCHAR(1000);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
