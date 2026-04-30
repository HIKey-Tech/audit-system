BEGIN TRY

BEGIN TRAN;

IF EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE [name] = N'users_azure_oid_key'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[users]')
)
BEGIN
    ALTER TABLE [dbo].[users] DROP CONSTRAINT [users_azure_oid_key];
END;

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'users_azure_oid_key'
      AND [object_id] = OBJECT_ID(N'[dbo].[users]')
)
BEGIN
    DROP INDEX [users_azure_oid_key] ON [dbo].[users];
END;

CREATE UNIQUE NONCLUSTERED INDEX [users_azure_oid_key]
ON [dbo].[users]([azure_oid])
WHERE [azure_oid] IS NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
