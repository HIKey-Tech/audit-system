BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[users] ADD [mfa_enabled] BIT NOT NULL CONSTRAINT [users_mfa_enabled_df] DEFAULT 0,
[mfa_enrolled_at] DATETIME2,
[mfa_grace_until] DATETIME2,
[mfa_method] NVARCHAR(1000),
[mfa_totp_secret] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[password_reset_tokens] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [token_hash] NVARCHAR(1000) NOT NULL,
    [expires_at] DATETIME2 NOT NULL,
    [used_at] DATETIME2,
    [ip_address] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [password_reset_tokens_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [password_reset_tokens_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [password_reset_tokens_token_hash_key] UNIQUE NONCLUSTERED ([token_hash])
);

-- CreateTable
CREATE TABLE [dbo].[mfa_backup_codes] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [code_hash] NVARCHAR(1000) NOT NULL,
    [used_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [mfa_backup_codes_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [mfa_backup_codes_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[mfa_email_otps] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [code_hash] NVARCHAR(1000) NOT NULL,
    [expires_at] DATETIME2 NOT NULL,
    [consumed_at] DATETIME2,
    [attempts] INT NOT NULL CONSTRAINT [mfa_email_otps_attempts_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [mfa_email_otps_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [mfa_email_otps_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [password_reset_tokens_user_id_idx] ON [dbo].[password_reset_tokens]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [mfa_backup_codes_user_id_idx] ON [dbo].[mfa_backup_codes]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [mfa_email_otps_user_id_idx] ON [dbo].[mfa_email_otps]([user_id]);

-- AddForeignKey
ALTER TABLE [dbo].[password_reset_tokens] ADD CONSTRAINT [password_reset_tokens_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[mfa_backup_codes] ADD CONSTRAINT [mfa_backup_codes_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[mfa_email_otps] ADD CONSTRAINT [mfa_email_otps_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
