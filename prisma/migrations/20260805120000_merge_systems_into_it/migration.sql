BEGIN TRY

BEGIN TRAN;

-- GBB merged the separate "IT Audit" and "Systems Audit" modules into a single
-- "System/IT Audit" domain. `systems` is retired as an audit type; every record
-- created before the merge is folded into `it` so it appears in the merged
-- workspace and is tested against the merged control set.
--
-- Forward-only and safe to re-run: every statement is scoped to the `systems`
-- value, so a second execution matches nothing.

UPDATE [dbo].[audit_plan_items]        SET [audit_type] = 'it' WHERE [audit_type] = 'systems';
UPDATE [dbo].[audit_engagements]       SET [audit_type] = 'it' WHERE [audit_type] = 'systems';
UPDATE [dbo].[audit_checklists]        SET [audit_type] = 'it' WHERE [audit_type] = 'systems';
UPDATE [dbo].[audit_findings]          SET [category]   = 'it' WHERE [category]   = 'systems';
UPDATE [dbo].[working_paper_templates] SET [audit_type] = 'it' WHERE [audit_type] = 'systems';
UPDATE [dbo].[compliance_controls]     SET [audit_type] = 'it' WHERE [audit_type] = 'systems';

-- escalation_policies.audit_type is UNIQUE, so the `systems` and `it` rows
-- cannot be merged by an UPDATE. Keep the existing `it` policy and drop the
-- `systems` one; promote `systems` only when no `it` policy exists at all.
DELETE FROM [dbo].[escalation_policies]
WHERE [audit_type] = 'systems'
  AND EXISTS (SELECT 1 FROM [dbo].[escalation_policies] p WHERE p.[audit_type] = 'it');

UPDATE [dbo].[escalation_policies] SET [audit_type] = 'it' WHERE [audit_type] = 'systems';

-- Two seeded config rows still describe the pre-merge world: `audit_taxonomy`
-- lists `systems` as a selectable type, and `checklist_templates` holds a
-- separate `systems` control block plus an `it` block missing those controls.
-- The seed's upsert deliberately never overwrites `value` (so it cannot reset
-- admin-edited config), so these are removed here and recreated with merged
-- defaults on the next `db-seed`. Until then the application falls back to the
-- built-in CONTROL_SETS, which already carry the merged set.
DELETE FROM [dbo].[system_config] WHERE [key] IN ('audit_taxonomy', 'checklist_templates');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
