BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[workflow_approvals] (
    [id] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000) NOT NULL,
    [entity_id] NVARCHAR(1000) NOT NULL,
    [submitted_by_id] NVARCHAR(1000) NOT NULL,
    [current_level] INT NOT NULL CONSTRAINT [workflow_approvals_current_level_df] DEFAULT 1,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [workflow_approvals_status_df] DEFAULT 'pending',
    [rejection_reason] NVARCHAR(max),
    [completed_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [workflow_approvals_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [workflow_approvals_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[workflow_approval_steps] (
    [id] NVARCHAR(1000) NOT NULL,
    [approval_id] NVARCHAR(1000) NOT NULL,
    [level] INT NOT NULL,
    [approver_id] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [workflow_approval_steps_status_df] DEFAULT 'pending',
    [comment] NVARCHAR(max),
    [acted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [workflow_approval_steps_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [workflow_approval_steps_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[workflow_assignments] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [assigned_by_id] NVARCHAR(1000) NOT NULL,
    [assigned_at] DATETIME2 NOT NULL CONSTRAINT [workflow_assignments_assigned_at_df] DEFAULT CURRENT_TIMESTAMP,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [workflow_assignments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [workflow_assignments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[workflow_escalations] (
    [id] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000) NOT NULL,
    [entity_id] NVARCHAR(1000) NOT NULL,
    [escalation_level] INT NOT NULL,
    [escalated_to_id] NVARCHAR(1000) NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [notified_at] DATETIME2 NOT NULL CONSTRAINT [workflow_escalations_notified_at_df] DEFAULT CURRENT_TIMESTAMP,
    [acknowledged_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [workflow_escalations_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [workflow_escalations_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[escalation_policies] (
    [id] NVARCHAR(1000) NOT NULL,
    [audit_type] NVARCHAR(1000) NOT NULL,
    [level_1_hours] INT NOT NULL CONSTRAINT [escalation_policies_level_1_hours_df] DEFAULT 24,
    [level_2_hours] INT NOT NULL CONSTRAINT [escalation_policies_level_2_hours_df] DEFAULT 72,
    [level_3_hours] INT NOT NULL CONSTRAINT [escalation_policies_level_3_hours_df] DEFAULT 120,
    [level_4_hours] INT NOT NULL CONSTRAINT [escalation_policies_level_4_hours_df] DEFAULT 168,
    [is_active] BIT NOT NULL CONSTRAINT [escalation_policies_is_active_df] DEFAULT 1,
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [escalation_policies_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [escalation_policies_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [escalation_policies_audit_type_key] UNIQUE NONCLUSTERED ([audit_type])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_approvals_entity_type_idx] ON [dbo].[workflow_approvals]([entity_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_approvals_entity_id_idx] ON [dbo].[workflow_approvals]([entity_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_approvals_status_idx] ON [dbo].[workflow_approvals]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_approvals_submitted_by_id_idx] ON [dbo].[workflow_approvals]([submitted_by_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_approval_steps_approval_id_idx] ON [dbo].[workflow_approval_steps]([approval_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_approval_steps_approver_id_idx] ON [dbo].[workflow_approval_steps]([approver_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_approval_steps_status_idx] ON [dbo].[workflow_approval_steps]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_approval_steps_level_idx] ON [dbo].[workflow_approval_steps]([level]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_assignments_engagement_id_idx] ON [dbo].[workflow_assignments]([engagement_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_assignments_user_id_idx] ON [dbo].[workflow_assignments]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_assignments_role_idx] ON [dbo].[workflow_assignments]([role]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_escalations_entity_type_idx] ON [dbo].[workflow_escalations]([entity_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_escalations_entity_id_idx] ON [dbo].[workflow_escalations]([entity_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_escalations_escalation_level_idx] ON [dbo].[workflow_escalations]([escalation_level]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_escalations_escalated_to_id_idx] ON [dbo].[workflow_escalations]([escalated_to_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [escalation_policies_audit_type_idx] ON [dbo].[escalation_policies]([audit_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [escalation_policies_is_active_idx] ON [dbo].[escalation_policies]([is_active]);

-- AddForeignKey
ALTER TABLE [dbo].[workflow_approvals] ADD CONSTRAINT [workflow_approvals_submitted_by_id_fkey] FOREIGN KEY ([submitted_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_approval_steps] ADD CONSTRAINT [workflow_approval_steps_approval_id_fkey] FOREIGN KEY ([approval_id]) REFERENCES [dbo].[workflow_approvals]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_approval_steps] ADD CONSTRAINT [workflow_approval_steps_approver_id_fkey] FOREIGN KEY ([approver_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_assignments] ADD CONSTRAINT [workflow_assignments_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_assignments] ADD CONSTRAINT [workflow_assignments_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_assignments] ADD CONSTRAINT [workflow_assignments_assigned_by_id_fkey] FOREIGN KEY ([assigned_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_escalations] ADD CONSTRAINT [workflow_escalations_escalated_to_id_fkey] FOREIGN KEY ([escalated_to_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[escalation_policies] ADD CONSTRAINT [escalation_policies_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
