BEGIN TRY

BEGIN TRAN;

-- Permission-based approval routing: an approval step now belongs to a permission
-- pool (any holder may act) rather than always being pinned to one user up-front.
-- approver_id becomes nullable (set when someone acts) and required_permission is added.

ALTER TABLE [dbo].[workflow_approval_steps] ALTER COLUMN [approver_id] NVARCHAR(1000) NULL;

ALTER TABLE [dbo].[workflow_approval_steps] ADD [required_permission] NVARCHAR(1000);

CREATE NONCLUSTERED INDEX [workflow_approval_steps_required_permission_idx] ON [dbo].[workflow_approval_steps]([required_permission]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
