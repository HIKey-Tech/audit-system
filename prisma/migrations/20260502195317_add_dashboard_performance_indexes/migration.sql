BEGIN TRY

BEGIN TRAN;

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_module_created_at_idx] ON [dbo].[audit_logs]([module], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_escalations_entity_type_entity_id_idx] ON [dbo].[workflow_escalations]([entity_type], [entity_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_escalations_escalation_level_notified_at_idx] ON [dbo].[workflow_escalations]([escalation_level], [notified_at]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
