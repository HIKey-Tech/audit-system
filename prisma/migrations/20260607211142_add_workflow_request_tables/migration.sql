BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[workflow_requests] (
    [id] NVARCHAR(1000) NOT NULL,
    [reference_number] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max),
    [initiator_id] NVARCHAR(1000) NOT NULL,
    [current_level] INT NOT NULL CONSTRAINT [workflow_requests_current_level_df] DEFAULT 1,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [workflow_requests_status_df] DEFAULT 'pending',
    [locked_at] DATETIME2,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [workflow_requests_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [workflow_requests_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [workflow_requests_reference_number_key] UNIQUE NONCLUSTERED ([reference_number])
);

-- CreateTable
CREATE TABLE [dbo].[workflow_request_steps] (
    [id] NVARCHAR(1000) NOT NULL,
    [request_id] NVARCHAR(1000) NOT NULL,
    [level] INT NOT NULL,
    [recipient_id] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [workflow_request_steps_status_df] DEFAULT 'pending',
    [acted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [workflow_request_steps_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [workflow_request_steps_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [workflow_request_steps_request_id_level_key] UNIQUE NONCLUSTERED ([request_id],[level])
);

-- CreateTable
CREATE TABLE [dbo].[workflow_request_actions] (
    [id] NVARCHAR(1000) NOT NULL,
    [request_id] NVARCHAR(1000) NOT NULL,
    [step_id] NVARCHAR(1000),
    [actor_id] NVARCHAR(1000) NOT NULL,
    [action_type] NVARCHAR(1000) NOT NULL,
    [comment] NVARCHAR(max),
    [signature_hash] NVARCHAR(1000),
    [signature_manifest] NVARCHAR(max),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [workflow_request_actions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [workflow_request_actions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_requests_initiator_id_idx] ON [dbo].[workflow_requests]([initiator_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_requests_status_idx] ON [dbo].[workflow_requests]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_requests_reference_number_idx] ON [dbo].[workflow_requests]([reference_number]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_request_steps_request_id_idx] ON [dbo].[workflow_request_steps]([request_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_request_steps_recipient_id_idx] ON [dbo].[workflow_request_steps]([recipient_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_request_steps_status_idx] ON [dbo].[workflow_request_steps]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_request_actions_request_id_idx] ON [dbo].[workflow_request_actions]([request_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_request_actions_step_id_idx] ON [dbo].[workflow_request_actions]([step_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_request_actions_actor_id_idx] ON [dbo].[workflow_request_actions]([actor_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_request_actions_action_type_idx] ON [dbo].[workflow_request_actions]([action_type]);

-- AddForeignKey
ALTER TABLE [dbo].[workflow_requests] ADD CONSTRAINT [workflow_requests_initiator_id_fkey] FOREIGN KEY ([initiator_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_request_steps] ADD CONSTRAINT [workflow_request_steps_request_id_fkey] FOREIGN KEY ([request_id]) REFERENCES [dbo].[workflow_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_request_steps] ADD CONSTRAINT [workflow_request_steps_recipient_id_fkey] FOREIGN KEY ([recipient_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_request_actions] ADD CONSTRAINT [workflow_request_actions_request_id_fkey] FOREIGN KEY ([request_id]) REFERENCES [dbo].[workflow_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_request_actions] ADD CONSTRAINT [workflow_request_actions_step_id_fkey] FOREIGN KEY ([step_id]) REFERENCES [dbo].[workflow_request_steps]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_request_actions] ADD CONSTRAINT [workflow_request_actions_actor_id_fkey] FOREIGN KEY ([actor_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
