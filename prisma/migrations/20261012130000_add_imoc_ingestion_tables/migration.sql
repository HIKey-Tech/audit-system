BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[imoc_ticket_links] ADD [imoc_ticket_id] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[imoc_tickets] (
    [id] NVARCHAR(1000) NOT NULL,
    [order_id] NVARCHAR(1000) NOT NULL,
    [order_number] NVARCHAR(1000) NOT NULL,
    [order_name] NVARCHAR(1000),
    [model_id] NVARCHAR(1000),
    [model_name] NVARCHAR(1000),
    [model_type] NVARCHAR(1000),
    [order_source] NVARCHAR(1000),
    [order_status] NVARCHAR(1000),
    [sla_status] NVARCHAR(1000),
    [priority] NVARCHAR(1000),
    [current_handler] NVARCHAR(1000),
    [created_by_name] NVARCHAR(1000),
    [imoc_created_at] DATETIME2,
    [imoc_ended_at] DATETIME2,
    [category] NVARCHAR(1000),
    [matched_rule_ids] NVARCHAR(max),
    [first_ingested_at] DATETIME2 NOT NULL CONSTRAINT [imoc_tickets_first_ingested_at_df] DEFAULT CURRENT_TIMESTAMP,
    [last_synced_at] DATETIME2 NOT NULL CONSTRAINT [imoc_tickets_last_synced_at_df] DEFAULT CURRENT_TIMESTAMP,
    [source_hash] NVARCHAR(128),
    [is_active] BIT NOT NULL CONSTRAINT [imoc_tickets_is_active_df] DEFAULT 1,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [imoc_tickets_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [imoc_tickets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [imoc_tickets_order_id_key] UNIQUE NONCLUSTERED ([order_id]),
    CONSTRAINT [imoc_tickets_order_number_key] UNIQUE NONCLUSTERED ([order_number])
);

-- CreateTable
CREATE TABLE [dbo].[imoc_ingestion_rules] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [imoc_ingestion_rules_is_active_df] DEFAULT 1,
    [priority] INT NOT NULL CONSTRAINT [imoc_ingestion_rules_priority_df] DEFAULT 100,
    [criteria_json] NVARCHAR(max) NOT NULL,
    [category] NVARCHAR(1000),
    [risk_category_id] NVARCHAR(1000),
    [lookback_days] INT NOT NULL CONSTRAINT [imoc_ingestion_rules_lookback_days_df] DEFAULT 30,
    [last_run_at] DATETIME2,
    [last_run_status] NVARCHAR(1000),
    [last_run_fetched] INT,
    [last_run_ingested] INT,
    [last_run_error] NVARCHAR(1000),
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [updated_by_id] NVARCHAR(1000),
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [imoc_ingestion_rules_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [imoc_ingestion_rules_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [imoc_ingestion_rules_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[imoc_ingestion_runs] (
    [id] NVARCHAR(1000) NOT NULL,
    [trigger] NVARCHAR(1000) NOT NULL,
    [triggered_by_id] NVARCHAR(1000),
    [started_at] DATETIME2 NOT NULL CONSTRAINT [imoc_ingestion_runs_started_at_df] DEFAULT CURRENT_TIMESTAMP,
    [finished_at] DATETIME2,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [imoc_ingestion_runs_status_df] DEFAULT 'running',
    [rules_evaluated] INT NOT NULL CONSTRAINT [imoc_ingestion_runs_rules_evaluated_df] DEFAULT 0,
    [fetched] INT NOT NULL CONSTRAINT [imoc_ingestion_runs_fetched_df] DEFAULT 0,
    [created] INT NOT NULL CONSTRAINT [imoc_ingestion_runs_created_df] DEFAULT 0,
    [updated] INT NOT NULL CONSTRAINT [imoc_ingestion_runs_updated_df] DEFAULT 0,
    [skipped] INT NOT NULL CONSTRAINT [imoc_ingestion_runs_skipped_df] DEFAULT 0,
    [error_summary] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [imoc_ingestion_runs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [imoc_ingestion_runs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[imoc_saved_views] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [filters_json] NVARCHAR(max) NOT NULL,
    [owner_id] NVARCHAR(1000) NOT NULL,
    [is_default] BIT NOT NULL CONSTRAINT [imoc_saved_views_is_default_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [imoc_saved_views_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [imoc_saved_views_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [imoc_saved_views_owner_id_name_key] UNIQUE NONCLUSTERED ([owner_id],[name])
);

-- CreateTable
CREATE TABLE [dbo].[imoc_ticket_risk_links] (
    [id] NVARCHAR(1000) NOT NULL,
    [imoc_ticket_id] NVARCHAR(1000) NOT NULL,
    [risk_id] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(max),
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [imoc_ticket_risk_links_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [imoc_ticket_risk_links_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [imoc_ticket_risk_links_imoc_ticket_id_risk_id_key] UNIQUE NONCLUSTERED ([imoc_ticket_id],[risk_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_tickets_order_status_idx] ON [dbo].[imoc_tickets]([order_status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_tickets_sla_status_idx] ON [dbo].[imoc_tickets]([sla_status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_tickets_category_idx] ON [dbo].[imoc_tickets]([category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_tickets_imoc_created_at_idx] ON [dbo].[imoc_tickets]([imoc_created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_tickets_model_id_idx] ON [dbo].[imoc_tickets]([model_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_tickets_is_active_idx] ON [dbo].[imoc_tickets]([is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_ingestion_rules_is_active_priority_idx] ON [dbo].[imoc_ingestion_rules]([is_active], [priority]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_ingestion_runs_started_at_idx] ON [dbo].[imoc_ingestion_runs]([started_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_ingestion_runs_status_idx] ON [dbo].[imoc_ingestion_runs]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_saved_views_owner_id_idx] ON [dbo].[imoc_saved_views]([owner_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_ticket_risk_links_imoc_ticket_id_idx] ON [dbo].[imoc_ticket_risk_links]([imoc_ticket_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_ticket_risk_links_risk_id_idx] ON [dbo].[imoc_ticket_risk_links]([risk_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [imoc_ticket_links_imoc_ticket_id_idx] ON [dbo].[imoc_ticket_links]([imoc_ticket_id]);

-- AddForeignKey
ALTER TABLE [dbo].[imoc_ticket_links] ADD CONSTRAINT [imoc_ticket_links_imoc_ticket_id_fkey] FOREIGN KEY ([imoc_ticket_id]) REFERENCES [dbo].[imoc_tickets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[imoc_ingestion_rules] ADD CONSTRAINT [imoc_ingestion_rules_risk_category_id_fkey] FOREIGN KEY ([risk_category_id]) REFERENCES [dbo].[risk_categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[imoc_ingestion_rules] ADD CONSTRAINT [imoc_ingestion_rules_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[imoc_ingestion_rules] ADD CONSTRAINT [imoc_ingestion_rules_updated_by_id_fkey] FOREIGN KEY ([updated_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[imoc_ingestion_runs] ADD CONSTRAINT [imoc_ingestion_runs_triggered_by_id_fkey] FOREIGN KEY ([triggered_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[imoc_saved_views] ADD CONSTRAINT [imoc_saved_views_owner_id_fkey] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[imoc_ticket_risk_links] ADD CONSTRAINT [imoc_ticket_risk_links_imoc_ticket_id_fkey] FOREIGN KEY ([imoc_ticket_id]) REFERENCES [dbo].[imoc_tickets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[imoc_ticket_risk_links] ADD CONSTRAINT [imoc_ticket_risk_links_risk_id_fkey] FOREIGN KEY ([risk_id]) REFERENCES [dbo].[risk_register]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[imoc_ticket_risk_links] ADD CONSTRAINT [imoc_ticket_risk_links_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

