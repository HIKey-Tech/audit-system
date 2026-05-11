BEGIN TRY

BEGIN TRAN;

-- Add super-admin bypass flag to users.
ALTER TABLE [dbo].[users]
ADD [is_super_admin] BIT NOT NULL CONSTRAINT [users_is_super_admin_df] DEFAULT 0;

-- Add slug as nullable first so existing permission rows can be backfilled.
ALTER TABLE [dbo].[permissions]
ADD [slug] NVARCHAR(1000);

EXEC(N'UPDATE [dbo].[permissions] SET [slug] = [name] WHERE [slug] IS NULL');

EXEC(N'ALTER TABLE [dbo].[permissions] ALTER COLUMN [slug] NVARCHAR(1000) NOT NULL');

UPDATE [dbo].[permissions]
SET [description] = ''
WHERE [description] IS NULL;

ALTER TABLE [dbo].[permissions]
ALTER COLUMN [description] NVARCHAR(1000) NOT NULL;

IF EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE [name] = N'permissions_name_key'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[permissions]')
)
BEGIN
    ALTER TABLE [dbo].[permissions] DROP CONSTRAINT [permissions_name_key];
END;

ALTER TABLE [dbo].[permissions]
ADD CONSTRAINT [permissions_slug_key] UNIQUE NONCLUSTERED ([slug]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
