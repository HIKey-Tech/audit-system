BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[risk_register] ADD [business_objective] NVARCHAR(500);

-- CreateTable
CREATE TABLE [dbo].[system_logs] (
    [id] NVARCHAR(1000) NOT NULL,
    [level] NVARCHAR(1000) NOT NULL,
    [message] NVARCHAR(2000) NOT NULL,
    [source] NVARCHAR(1000),
    [error_name] NVARCHAR(1000),
    [path] NVARCHAR(500),
    [request_id] NVARCHAR(1000),
    [stack] NVARCHAR(max),
    [context] NVARCHAR(max),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [system_logs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [system_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_logs_created_at_idx] ON [dbo].[system_logs]([created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_logs_level_created_at_idx] ON [dbo].[system_logs]([level], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_logs_source_created_at_idx] ON [dbo].[system_logs]([source], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [risk_register_business_objective_idx] ON [dbo].[risk_register]([business_objective]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
