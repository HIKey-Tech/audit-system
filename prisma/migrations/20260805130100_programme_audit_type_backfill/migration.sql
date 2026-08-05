BEGIN TRY

BEGIN TRAN;

-- Second half of the programme audit-type move. By the time this runs,
-- audit_plans.audit_type exists (added in 20260805130000) and
-- audit_plan_items.audit_type still exists, so every statement below compiles.
--
-- The guard skips the data changes if the item column is already gone. Note it
-- guards execution, not compilation: SQL Server still compiles the block, so a
-- manual replay after the column is dropped would fail on name resolution.
-- Prisma applies each migration exactly once, so that path never occurs here.
IF COL_LENGTH('dbo.audit_plan_items', 'audit_type') IS NOT NULL
BEGIN

    -- ── 1. Dominant type per plan ───────────────────────────────────────────
    -- Ties break on the type name so the result is deterministic across replays.
    WITH ranked AS (
        SELECT
            i.[plan_id],
            i.[audit_type],
            ROW_NUMBER() OVER (
                PARTITION BY i.[plan_id]
                ORDER BY COUNT(*) DESC, i.[audit_type] ASC
            ) AS rn
        FROM [dbo].[audit_plan_items] i
        GROUP BY i.[plan_id], i.[audit_type]
    )
    UPDATE p
    SET p.[audit_type] = r.[audit_type]
    FROM [dbo].[audit_plans] p
    INNER JOIN ranked r ON r.[plan_id] = p.[id] AND r.rn = 1;

    -- Plans with no items at all (empty drafts) have nothing to infer from.
    UPDATE [dbo].[audit_plans] SET [audit_type] = 'it' WHERE [audit_type] IS NULL;

    -- ── 2. Split plans that held more than one audit type ───────────────────
    -- The original row keeps its dominant type AND its id, so its approval
    -- history and signed documents stay attached. Each additional type becomes
    -- a new programme carrying the same year, status and approval outcome, and
    -- the items of that type are repointed to it.
    DECLARE @plan_id NVARCHAR(1000), @audit_type NVARCHAR(1000), @new_id NVARCHAR(1000);

    DECLARE split_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT DISTINCT i.[plan_id], i.[audit_type]
        FROM [dbo].[audit_plan_items] i
        INNER JOIN [dbo].[audit_plans] p ON p.[id] = i.[plan_id]
        WHERE i.[audit_type] <> p.[audit_type];

    OPEN split_cursor;
    FETCH NEXT FROM split_cursor INTO @plan_id, @audit_type;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @new_id = CONVERT(NVARCHAR(1000), NEWID());

        INSERT INTO [dbo].[audit_plans]
            ([id], [title], [year], [audit_type], [description], [status],
             [created_by_id], [approved_by_id], [approved_at], [rejection_reason],
             [deleted_at], [created_at], [updated_at])
        SELECT
            @new_id,
            LEFT(p.[title] + N' — ' + UPPER(LEFT(@audit_type, 1)) + SUBSTRING(@audit_type, 2, 100), 200),
            p.[year],
            @audit_type,
            p.[description],
            p.[status],
            p.[created_by_id],
            p.[approved_by_id],
            p.[approved_at],
            p.[rejection_reason],
            p.[deleted_at],
            p.[created_at],
            SYSDATETIME()
        FROM [dbo].[audit_plans] p
        WHERE p.[id] = @plan_id;

        UPDATE [dbo].[audit_plan_items]
        SET [plan_id] = @new_id
        WHERE [plan_id] = @plan_id AND [audit_type] = @audit_type;

        FETCH NEXT FROM split_cursor INTO @plan_id, @audit_type;
    END;

    CLOSE split_cursor;
    DEALLOCATE split_cursor;

    -- ── 3. Lock the column down and index it ────────────────────────────────
    ALTER TABLE [dbo].[audit_plans] ALTER COLUMN [audit_type] NVARCHAR(1000) NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'audit_plans_audit_type_idx' AND object_id = OBJECT_ID('dbo.audit_plans'))
        CREATE NONCLUSTERED INDEX [audit_plans_audit_type_idx] ON [dbo].[audit_plans]([audit_type]);

    -- ── 4. Drop the item-level column — the programme is now the only source ─
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'audit_plan_items_audit_type_idx' AND object_id = OBJECT_ID('dbo.audit_plan_items'))
        DROP INDEX [audit_plan_items_audit_type_idx] ON [dbo].[audit_plan_items];

    ALTER TABLE [dbo].[audit_plan_items] DROP COLUMN [audit_type];

END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
