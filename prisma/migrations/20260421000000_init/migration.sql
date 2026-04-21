BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] NVARCHAR(1000) NOT NULL,
    [azure_oid] NVARCHAR(1000),
    [email] NVARCHAR(1000) NOT NULL,
    [email_verified] BIT NOT NULL CONSTRAINT [users_email_verified_df] DEFAULT 0,
    [first_name] NVARCHAR(1000) NOT NULL,
    [last_name] NVARCHAR(1000) NOT NULL,
    [display_name] NVARCHAR(1000),
    [avatar_url] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [department] NVARCHAR(1000),
    [job_title] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [users_is_active_df] DEFAULT 1,
    [is_system_user] BIT NOT NULL CONSTRAINT [users_is_system_user_df] DEFAULT 0,
    [last_login_at] DATETIME2,
    [password_hash] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_azure_oid_key] UNIQUE NONCLUSTERED ([azure_oid]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[roles] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [is_system] BIT NOT NULL CONSTRAINT [roles_is_system_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [roles_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [roles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [roles_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[permissions] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [module] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [permissions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [permissions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [permissions_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[user_roles] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [role_id] NVARCHAR(1000) NOT NULL,
    [assigned_by] NVARCHAR(1000),
    [assigned_at] DATETIME2 NOT NULL CONSTRAINT [user_roles_assigned_at_df] DEFAULT CURRENT_TIMESTAMP,
    [expires_at] DATETIME2,
    CONSTRAINT [user_roles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [user_roles_user_id_role_id_key] UNIQUE NONCLUSTERED ([user_id],[role_id])
);

-- CreateTable
CREATE TABLE [dbo].[role_permissions] (
    [id] NVARCHAR(1000) NOT NULL,
    [role_id] NVARCHAR(1000) NOT NULL,
    [permission_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [role_permissions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [role_permissions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [role_permissions_role_id_permission_id_key] UNIQUE NONCLUSTERED ([role_id],[permission_id])
);

-- CreateTable
CREATE TABLE [dbo].[refresh_tokens] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [token_hash] NVARCHAR(1000) NOT NULL,
    [expires_at] DATETIME2 NOT NULL,
    [revoked_at] DATETIME2,
    [ip_address] NVARCHAR(1000),
    [user_agent] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [refresh_tokens_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [refresh_tokens_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [refresh_tokens_token_hash_key] UNIQUE NONCLUSTERED ([token_hash])
);

-- CreateTable
CREATE TABLE [dbo].[audit_logs] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000),
    [action] NVARCHAR(1000) NOT NULL,
    [module] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000),
    [entity_id] NVARCHAR(1000),
    [old_values] NVARCHAR(1000),
    [new_values] NVARCHAR(1000),
    [ip_address] NVARCHAR(1000),
    [user_agent] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_logs_status_df] DEFAULT 'success',
    [error_message] NVARCHAR(1000),
    [duration_ms] INT,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_logs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[notifications] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [body] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [channel] NVARCHAR(1000) NOT NULL,
    [is_read] BIT NOT NULL CONSTRAINT [notifications_is_read_df] DEFAULT 0,
    [read_at] DATETIME2,
    [reference_type] NVARCHAR(1000),
    [reference_id] NVARCHAR(1000),
    [metadata] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [notifications_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [notifications_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[email_logs] (
    [id] NVARCHAR(1000) NOT NULL,
    [to_address] NVARCHAR(1000) NOT NULL,
    [from_address] NVARCHAR(1000) NOT NULL,
    [subject] NVARCHAR(1000) NOT NULL,
    [template] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [email_logs_status_df] DEFAULT 'pending',
    [error] NVARCHAR(1000),
    [sent_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [email_logs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [email_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[documents] (
    [id] NVARCHAR(1000) NOT NULL,
    [uploaded_by_id] NVARCHAR(1000) NOT NULL,
    [original_name] NVARCHAR(1000) NOT NULL,
    [stored_name] NVARCHAR(1000) NOT NULL,
    [mime_type] NVARCHAR(1000) NOT NULL,
    [file_size] INT NOT NULL,
    [storage_path] NVARCHAR(1000) NOT NULL,
    [storage_provider] NVARCHAR(1000) NOT NULL,
    [module] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000),
    [entity_id] NVARCHAR(1000),
    [version_number] INT NOT NULL CONSTRAINT [documents_version_number_df] DEFAULT 1,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [documents_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [documents_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[document_versions] (
    [id] NVARCHAR(1000) NOT NULL,
    [document_id] NVARCHAR(1000) NOT NULL,
    [version_number] INT NOT NULL,
    [uploaded_by_id] NVARCHAR(1000) NOT NULL,
    [original_name] NVARCHAR(1000) NOT NULL,
    [stored_name] NVARCHAR(1000) NOT NULL,
    [mime_type] NVARCHAR(1000) NOT NULL,
    [file_size] INT NOT NULL,
    [storage_path] NVARCHAR(1000) NOT NULL,
    [storage_provider] NVARCHAR(1000) NOT NULL,
    [change_note] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [document_versions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [document_versions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [document_versions_document_id_version_number_key] UNIQUE NONCLUSTERED ([document_id],[version_number])
);

-- CreateTable
CREATE TABLE [dbo].[document_templates] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [category] NVARCHAR(1000) NOT NULL,
    [content] NVARCHAR(1000),
    [document_id] NVARCHAR(1000),
    [metadata] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [document_templates_is_active_df] DEFAULT 1,
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [updated_by_id] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [document_templates_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [document_templates_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [document_templates_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[scheduled_jobs] (
    [id] NVARCHAR(1000) NOT NULL,
    [job_key] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [cron_expression] NVARCHAR(1000) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [scheduled_jobs_is_active_df] DEFAULT 1,
    [last_run_at] DATETIME2,
    [next_run_at] DATETIME2,
    [last_status] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [scheduled_jobs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [scheduled_jobs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [scheduled_jobs_job_key_key] UNIQUE NONCLUSTERED ([job_key])
);

-- CreateTable
CREATE TABLE [dbo].[scheduled_job_runs] (
    [id] NVARCHAR(1000) NOT NULL,
    [job_id] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [started_at] DATETIME2 NOT NULL CONSTRAINT [scheduled_job_runs_started_at_df] DEFAULT CURRENT_TIMESTAMP,
    [completed_at] DATETIME2,
    [error] NVARCHAR(1000),
    [metadata] NVARCHAR(1000),
    CONSTRAINT [scheduled_job_runs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_user_id_idx] ON [dbo].[audit_logs]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_module_idx] ON [dbo].[audit_logs]([module]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_created_at_idx] ON [dbo].[audit_logs]([created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_user_id_is_read_idx] ON [dbo].[notifications]([user_id], [is_read]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documents_entity_type_entity_id_idx] ON [dbo].[documents]([entity_type], [entity_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [document_versions_document_id_idx] ON [dbo].[document_versions]([document_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [document_templates_category_idx] ON [dbo].[document_templates]([category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [document_templates_is_active_idx] ON [dbo].[document_templates]([is_active]);

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[roles]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[role_permissions] ADD CONSTRAINT [role_permissions_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[roles]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[role_permissions] ADD CONSTRAINT [role_permissions_permission_id_fkey] FOREIGN KEY ([permission_id]) REFERENCES [dbo].[permissions]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[refresh_tokens] ADD CONSTRAINT [refresh_tokens_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[audit_logs] ADD CONSTRAINT [audit_logs_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[notifications] ADD CONSTRAINT [notifications_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[documents] ADD CONSTRAINT [documents_uploaded_by_id_fkey] FOREIGN KEY ([uploaded_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[document_versions] ADD CONSTRAINT [document_versions_document_id_fkey] FOREIGN KEY ([document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[document_versions] ADD CONSTRAINT [document_versions_uploaded_by_id_fkey] FOREIGN KEY ([uploaded_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[document_templates] ADD CONSTRAINT [document_templates_document_id_fkey] FOREIGN KEY ([document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[document_templates] ADD CONSTRAINT [document_templates_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[document_templates] ADD CONSTRAINT [document_templates_updated_by_id_fkey] FOREIGN KEY ([updated_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[scheduled_job_runs] ADD CONSTRAINT [scheduled_job_runs_job_id_fkey] FOREIGN KEY ([job_id]) REFERENCES [dbo].[scheduled_jobs]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

