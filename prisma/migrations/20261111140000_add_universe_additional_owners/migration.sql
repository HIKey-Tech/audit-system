BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[audit_universe_owners] (
    [id] NVARCHAR(1000) NOT NULL,
    [universe_id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_universe_owners_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_universe_owners_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_universe_owners_universe_id_user_id_key] UNIQUE NONCLUSTERED ([universe_id],[user_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_universe_owners_user_id_idx] ON [dbo].[audit_universe_owners]([user_id]);

-- AddForeignKey
ALTER TABLE [dbo].[audit_universe_owners] ADD CONSTRAINT [audit_universe_owners_universe_id_fkey] FOREIGN KEY ([universe_id]) REFERENCES [dbo].[audit_universe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_universe_owners] ADD CONSTRAINT [audit_universe_owners_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

