BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[compliance_control_risks] (
    [id] NVARCHAR(1000) NOT NULL,
    [control_id] NVARCHAR(1000) NOT NULL,
    [risk_id] NVARCHAR(1000) NOT NULL,
    [created_by_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [compliance_control_risks_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [compliance_control_risks_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [compliance_control_risks_control_id_risk_id_key] UNIQUE NONCLUSTERED ([control_id],[risk_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [compliance_control_risks_control_id_idx] ON [dbo].[compliance_control_risks]([control_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [compliance_control_risks_risk_id_idx] ON [dbo].[compliance_control_risks]([risk_id]);

-- AddForeignKey
ALTER TABLE [dbo].[compliance_control_risks] ADD CONSTRAINT [compliance_control_risks_control_id_fkey] FOREIGN KEY ([control_id]) REFERENCES [dbo].[compliance_controls]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[compliance_control_risks] ADD CONSTRAINT [compliance_control_risks_risk_id_fkey] FOREIGN KEY ([risk_id]) REFERENCES [dbo].[risk_register]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
