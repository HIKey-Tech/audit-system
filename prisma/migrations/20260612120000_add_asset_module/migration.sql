BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[assets] (
    [id] NVARCHAR(1000) NOT NULL,
    [asset_tag] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max),
    [asset_type] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [assets_status_df] DEFAULT 'active',
    [lifecycle_state] NVARCHAR(1000) NOT NULL CONSTRAINT [assets_lifecycle_state_df] DEFAULT 'active',
    [criticality] NVARCHAR(1000) NOT NULL CONSTRAINT [assets_criticality_df] DEFAULT 'medium',
    [data_classification] NVARCHAR(1000) NOT NULL CONSTRAINT [assets_data_classification_df] DEFAULT 'internal',
    [confidentiality_rating] NVARCHAR(1000) NOT NULL CONSTRAINT [assets_confidentiality_rating_df] DEFAULT 'medium',
    [integrity_rating] NVARCHAR(1000) NOT NULL CONSTRAINT [assets_integrity_rating_df] DEFAULT 'medium',
    [availability_rating] NVARCHAR(1000) NOT NULL CONSTRAINT [assets_availability_rating_df] DEFAULT 'medium',
    [owner_id] NVARCHAR(1000) NOT NULL,
    [custodian_id] NVARCHAR(1000),
    [department] NVARCHAR(1000),
    [location] NVARCHAR(1000),
    [environment] NVARCHAR(1000),
    [hostname] NVARCHAR(1000),
    [ip_address] NVARCHAR(1000),
    [serial_number] NVARCHAR(1000),
    [manufacturer] NVARCHAR(1000),
    [model] NVARCHAR(1000),
    [os_name] NVARCHAR(1000),
    [os_version] NVARCHAR(1000),
    [supplier] NVARCHAR(1000),
    [source_system] NVARCHAR(1000) NOT NULL CONSTRAINT [assets_source_system_df] DEFAULT 'manual',
    [source_id] NVARCHAR(1000),
    [last_seen_at] DATETIME2,
    [last_attested_at] DATETIME2,
    [metadata] NVARCHAR(max),
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [deleted_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [assets_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [assets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [assets_asset_tag_key] UNIQUE NONCLUSTERED ([asset_tag])
);

-- CreateTable
CREATE TABLE [dbo].[asset_relationships] (
    [id] NVARCHAR(1000) NOT NULL,
    [source_asset_id] NVARCHAR(1000) NOT NULL,
    [target_asset_id] NVARCHAR(1000) NOT NULL,
    [relationship_type] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max),
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [asset_relationships_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [asset_relationships_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [asset_relationships_source_asset_id_target_asset_id_relationship_type_key] UNIQUE NONCLUSTERED ([source_asset_id],[target_asset_id],[relationship_type])
);

-- CreateTable
CREATE TABLE [dbo].[asset_attestations] (
    [id] NVARCHAR(1000) NOT NULL,
    [asset_id] NVARCHAR(1000) NOT NULL,
    [attested_by_id] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [asset_attestations_status_df] DEFAULT 'confirmed',
    [notes] NVARCHAR(max),
    [snapshot] NVARCHAR(max) NOT NULL,
    [attested_at] DATETIME2 NOT NULL CONSTRAINT [asset_attestations_attested_at_df] DEFAULT CURRENT_TIMESTAMP,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [asset_attestations_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [asset_attestations_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[asset_sources] (
    [id] NVARCHAR(1000) NOT NULL,
    [asset_id] NVARCHAR(1000) NOT NULL,
    [source_system] NVARCHAR(1000) NOT NULL,
    [source_id] NVARCHAR(1000) NOT NULL,
    [sync_status] NVARCHAR(1000) NOT NULL CONSTRAINT [asset_sources_sync_status_df] DEFAULT 'synced',
    [last_synced_at] DATETIME2,
    [raw_payload] NVARCHAR(max),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [asset_sources_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [asset_sources_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [asset_sources_source_system_source_id_key] UNIQUE NONCLUSTERED ([source_system],[source_id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_universe_assets] (
    [id] NVARCHAR(1000) NOT NULL,
    [universe_id] NVARCHAR(1000) NOT NULL,
    [asset_id] NVARCHAR(1000) NOT NULL,
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_universe_assets_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_universe_assets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_universe_assets_universe_id_asset_id_key] UNIQUE NONCLUSTERED ([universe_id],[asset_id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_engagement_assets] (
    [id] NVARCHAR(1000) NOT NULL,
    [engagement_id] NVARCHAR(1000) NOT NULL,
    [asset_id] NVARCHAR(1000) NOT NULL,
    [scope_role] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_engagement_assets_scope_role_df] DEFAULT 'primary',
    [scope_reason] NVARCHAR(max),
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_engagement_assets_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_engagement_assets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_engagement_assets_engagement_id_asset_id_key] UNIQUE NONCLUSTERED ([engagement_id],[asset_id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_finding_assets] (
    [id] NVARCHAR(1000) NOT NULL,
    [finding_id] NVARCHAR(1000) NOT NULL,
    [asset_id] NVARCHAR(1000) NOT NULL,
    [impact_summary] NVARCHAR(max),
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_finding_assets_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_finding_assets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_finding_assets_finding_id_asset_id_key] UNIQUE NONCLUSTERED ([finding_id],[asset_id])
);

-- CreateTable
CREATE TABLE [dbo].[risk_asset_links] (
    [id] NVARCHAR(1000) NOT NULL,
    [risk_id] NVARCHAR(1000) NOT NULL,
    [asset_id] NVARCHAR(1000) NOT NULL,
    [link_reason] NVARCHAR(max),
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [risk_asset_links_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [risk_asset_links_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [risk_asset_links_risk_id_asset_id_key] UNIQUE NONCLUSTERED ([risk_id],[asset_id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_evidence_assets] (
    [id] NVARCHAR(1000) NOT NULL,
    [evidence_id] NVARCHAR(1000) NOT NULL,
    [asset_id] NVARCHAR(1000) NOT NULL,
    [created_by_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [audit_evidence_assets_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_evidence_assets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [audit_evidence_assets_evidence_id_asset_id_key] UNIQUE NONCLUSTERED ([evidence_id],[asset_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [assets_asset_type_idx] ON [dbo].[assets]([asset_type]);
CREATE NONCLUSTERED INDEX [assets_status_idx] ON [dbo].[assets]([status]);
CREATE NONCLUSTERED INDEX [assets_lifecycle_state_idx] ON [dbo].[assets]([lifecycle_state]);
CREATE NONCLUSTERED INDEX [assets_criticality_idx] ON [dbo].[assets]([criticality]);
CREATE NONCLUSTERED INDEX [assets_data_classification_idx] ON [dbo].[assets]([data_classification]);
CREATE NONCLUSTERED INDEX [assets_owner_id_idx] ON [dbo].[assets]([owner_id]);
CREATE NONCLUSTERED INDEX [assets_custodian_id_idx] ON [dbo].[assets]([custodian_id]);
CREATE NONCLUSTERED INDEX [assets_department_idx] ON [dbo].[assets]([department]);
CREATE NONCLUSTERED INDEX [assets_environment_idx] ON [dbo].[assets]([environment]);
CREATE NONCLUSTERED INDEX [assets_source_system_idx] ON [dbo].[assets]([source_system]);
CREATE NONCLUSTERED INDEX [assets_last_seen_at_idx] ON [dbo].[assets]([last_seen_at]);
CREATE NONCLUSTERED INDEX [assets_last_attested_at_idx] ON [dbo].[assets]([last_attested_at]);
CREATE NONCLUSTERED INDEX [asset_relationships_source_asset_id_idx] ON [dbo].[asset_relationships]([source_asset_id]);
CREATE NONCLUSTERED INDEX [asset_relationships_target_asset_id_idx] ON [dbo].[asset_relationships]([target_asset_id]);
CREATE NONCLUSTERED INDEX [asset_relationships_relationship_type_idx] ON [dbo].[asset_relationships]([relationship_type]);
CREATE NONCLUSTERED INDEX [asset_attestations_asset_id_idx] ON [dbo].[asset_attestations]([asset_id]);
CREATE NONCLUSTERED INDEX [asset_attestations_attested_by_id_idx] ON [dbo].[asset_attestations]([attested_by_id]);
CREATE NONCLUSTERED INDEX [asset_attestations_status_idx] ON [dbo].[asset_attestations]([status]);
CREATE NONCLUSTERED INDEX [asset_attestations_attested_at_idx] ON [dbo].[asset_attestations]([attested_at]);
CREATE NONCLUSTERED INDEX [asset_sources_asset_id_idx] ON [dbo].[asset_sources]([asset_id]);
CREATE NONCLUSTERED INDEX [asset_sources_source_system_idx] ON [dbo].[asset_sources]([source_system]);
CREATE NONCLUSTERED INDEX [asset_sources_sync_status_idx] ON [dbo].[asset_sources]([sync_status]);
CREATE NONCLUSTERED INDEX [asset_sources_last_synced_at_idx] ON [dbo].[asset_sources]([last_synced_at]);
CREATE NONCLUSTERED INDEX [audit_universe_assets_universe_id_idx] ON [dbo].[audit_universe_assets]([universe_id]);
CREATE NONCLUSTERED INDEX [audit_universe_assets_asset_id_idx] ON [dbo].[audit_universe_assets]([asset_id]);
CREATE NONCLUSTERED INDEX [audit_universe_assets_created_by_id_idx] ON [dbo].[audit_universe_assets]([created_by_id]);
CREATE NONCLUSTERED INDEX [audit_engagement_assets_engagement_id_idx] ON [dbo].[audit_engagement_assets]([engagement_id]);
CREATE NONCLUSTERED INDEX [audit_engagement_assets_asset_id_idx] ON [dbo].[audit_engagement_assets]([asset_id]);
CREATE NONCLUSTERED INDEX [audit_engagement_assets_scope_role_idx] ON [dbo].[audit_engagement_assets]([scope_role]);
CREATE NONCLUSTERED INDEX [audit_engagement_assets_created_by_id_idx] ON [dbo].[audit_engagement_assets]([created_by_id]);
CREATE NONCLUSTERED INDEX [audit_finding_assets_finding_id_idx] ON [dbo].[audit_finding_assets]([finding_id]);
CREATE NONCLUSTERED INDEX [audit_finding_assets_asset_id_idx] ON [dbo].[audit_finding_assets]([asset_id]);
CREATE NONCLUSTERED INDEX [audit_finding_assets_created_by_id_idx] ON [dbo].[audit_finding_assets]([created_by_id]);
CREATE NONCLUSTERED INDEX [risk_asset_links_risk_id_idx] ON [dbo].[risk_asset_links]([risk_id]);
CREATE NONCLUSTERED INDEX [risk_asset_links_asset_id_idx] ON [dbo].[risk_asset_links]([asset_id]);
CREATE NONCLUSTERED INDEX [risk_asset_links_created_by_id_idx] ON [dbo].[risk_asset_links]([created_by_id]);
CREATE NONCLUSTERED INDEX [audit_evidence_assets_evidence_id_idx] ON [dbo].[audit_evidence_assets]([evidence_id]);
CREATE NONCLUSTERED INDEX [audit_evidence_assets_asset_id_idx] ON [dbo].[audit_evidence_assets]([asset_id]);
CREATE NONCLUSTERED INDEX [audit_evidence_assets_created_by_id_idx] ON [dbo].[audit_evidence_assets]([created_by_id]);

-- AddForeignKey
ALTER TABLE [dbo].[assets] ADD CONSTRAINT [assets_owner_id_fkey] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[assets] ADD CONSTRAINT [assets_custodian_id_fkey] FOREIGN KEY ([custodian_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[assets] ADD CONSTRAINT [assets_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[asset_relationships] ADD CONSTRAINT [asset_relationships_source_asset_id_fkey] FOREIGN KEY ([source_asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[asset_relationships] ADD CONSTRAINT [asset_relationships_target_asset_id_fkey] FOREIGN KEY ([target_asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[asset_relationships] ADD CONSTRAINT [asset_relationships_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[asset_attestations] ADD CONSTRAINT [asset_attestations_asset_id_fkey] FOREIGN KEY ([asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[asset_attestations] ADD CONSTRAINT [asset_attestations_attested_by_id_fkey] FOREIGN KEY ([attested_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[asset_sources] ADD CONSTRAINT [asset_sources_asset_id_fkey] FOREIGN KEY ([asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_universe_assets] ADD CONSTRAINT [audit_universe_assets_universe_id_fkey] FOREIGN KEY ([universe_id]) REFERENCES [dbo].[audit_universe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_universe_assets] ADD CONSTRAINT [audit_universe_assets_asset_id_fkey] FOREIGN KEY ([asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_universe_assets] ADD CONSTRAINT [audit_universe_assets_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_engagement_assets] ADD CONSTRAINT [audit_engagement_assets_engagement_id_fkey] FOREIGN KEY ([engagement_id]) REFERENCES [dbo].[audit_engagements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_engagement_assets] ADD CONSTRAINT [audit_engagement_assets_asset_id_fkey] FOREIGN KEY ([asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_engagement_assets] ADD CONSTRAINT [audit_engagement_assets_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_finding_assets] ADD CONSTRAINT [audit_finding_assets_finding_id_fkey] FOREIGN KEY ([finding_id]) REFERENCES [dbo].[audit_findings]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_finding_assets] ADD CONSTRAINT [audit_finding_assets_asset_id_fkey] FOREIGN KEY ([asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_finding_assets] ADD CONSTRAINT [audit_finding_assets_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[risk_asset_links] ADD CONSTRAINT [risk_asset_links_risk_id_fkey] FOREIGN KEY ([risk_id]) REFERENCES [dbo].[risk_register]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[risk_asset_links] ADD CONSTRAINT [risk_asset_links_asset_id_fkey] FOREIGN KEY ([asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[risk_asset_links] ADD CONSTRAINT [risk_asset_links_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_evidence_assets] ADD CONSTRAINT [audit_evidence_assets_evidence_id_fkey] FOREIGN KEY ([evidence_id]) REFERENCES [dbo].[audit_evidence]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_evidence_assets] ADD CONSTRAINT [audit_evidence_assets_asset_id_fkey] FOREIGN KEY ([asset_id]) REFERENCES [dbo].[assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[audit_evidence_assets] ADD CONSTRAINT [audit_evidence_assets_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
