BEGIN TRY

BEGIN TRAN;

-- Internal predictive/analytics read store. No audit evidence or raw external
-- payload is copied here: snapshots contain only computed workflow features.
CREATE TABLE [dbo].[predictive_snapshots] (
    [id] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000) NOT NULL,
    [entity_id] NVARCHAR(1000) NOT NULL,
    [snapshot_date] DATETIME2 NOT NULL,
    [feature_json] NVARCHAR(max) NOT NULL,
    [feature_version] NVARCHAR(1000) NOT NULL CONSTRAINT [predictive_snapshots_feature_version_df] DEFAULT 'rules-v1',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [predictive_snapshots_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [predictive_snapshots_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [predictive_snapshots_entity_type_entity_id_snapshot_date_key] UNIQUE NONCLUSTERED ([entity_type], [entity_id], [snapshot_date])
);

CREATE TABLE [dbo].[predictive_insights] (
    [id] NVARCHAR(1000) NOT NULL,
    [insight_type] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000) NOT NULL,
    [entity_id] NVARCHAR(1000) NOT NULL,
    [severity] NVARCHAR(1000) NOT NULL,
    [score] INT NOT NULL,
    [title] NVARCHAR(500) NOT NULL,
    [summary] NVARCHAR(max) NOT NULL,
    [rationale_json] NVARCHAR(max) NOT NULL,
    [model_version] NVARCHAR(1000) NOT NULL CONSTRAINT [predictive_insights_model_version_df] DEFAULT 'rules-v1',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [predictive_insights_status_df] DEFAULT 'active',
    [generated_at] DATETIME2 NOT NULL CONSTRAINT [predictive_insights_generated_at_df] DEFAULT CURRENT_TIMESTAMP,
    [resolved_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [predictive_insights_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [predictive_insights_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [predictive_insights_insight_type_entity_type_entity_id_model_version_key] UNIQUE NONCLUSTERED ([insight_type], [entity_type], [entity_id], [model_version])
);

CREATE TABLE [dbo].[predictive_insight_feedback] (
    [id] NVARCHAR(1000) NOT NULL,
    [insight_id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [feedback] NVARCHAR(1000) NOT NULL,
    [comment] NVARCHAR(500),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [predictive_insight_feedback_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [predictive_insight_feedback_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [predictive_insight_feedback_insight_id_user_id_key] UNIQUE NONCLUSTERED ([insight_id], [user_id])
);

CREATE TABLE [dbo].[predictive_outcomes] (
    [id] NVARCHAR(1000) NOT NULL,
    [entity_type] NVARCHAR(1000) NOT NULL,
    [entity_id] NVARCHAR(1000) NOT NULL,
    [outcome_type] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    [observed_at] DATETIME2 NOT NULL,
    [metadata_json] NVARCHAR(max),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [predictive_outcomes_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [predictive_outcomes_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [predictive_outcomes_entity_type_entity_id_outcome_type_key] UNIQUE NONCLUSTERED ([entity_type], [entity_id], [outcome_type])
);

CREATE NONCLUSTERED INDEX [predictive_snapshots_entity_type_snapshot_date_idx] ON [dbo].[predictive_snapshots]([entity_type], [snapshot_date]);
CREATE NONCLUSTERED INDEX [predictive_snapshots_entity_id_idx] ON [dbo].[predictive_snapshots]([entity_id]);
CREATE NONCLUSTERED INDEX [predictive_insights_status_severity_idx] ON [dbo].[predictive_insights]([status], [severity]);
CREATE NONCLUSTERED INDEX [predictive_insights_entity_type_entity_id_idx] ON [dbo].[predictive_insights]([entity_type], [entity_id]);
CREATE NONCLUSTERED INDEX [predictive_insights_generated_at_idx] ON [dbo].[predictive_insights]([generated_at]);
CREATE NONCLUSTERED INDEX [predictive_insight_feedback_user_id_feedback_idx] ON [dbo].[predictive_insight_feedback]([user_id], [feedback]);
CREATE NONCLUSTERED INDEX [predictive_outcomes_outcome_type_value_idx] ON [dbo].[predictive_outcomes]([outcome_type], [value]);
CREATE NONCLUSTERED INDEX [predictive_outcomes_observed_at_idx] ON [dbo].[predictive_outcomes]([observed_at]);

ALTER TABLE [dbo].[predictive_insight_feedback]
  ADD CONSTRAINT [predictive_insight_feedback_insight_id_fkey]
  FOREIGN KEY ([insight_id]) REFERENCES [dbo].[predictive_insights]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [dbo].[predictive_insight_feedback]
  ADD CONSTRAINT [predictive_insight_feedback_user_id_fkey]
  FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH
