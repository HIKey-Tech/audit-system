# Deploying the audit roles, sole-auditor, reassignment and document-template release (2026-11-19)

Branch: **`dev`**. Follows `VPS_DEPLOYMENT_RUNBOOK.md` §10 ("Deploy an update") on the GBB VPS (`/opt/iams/app`).
**Estimated downtime:** ~2–4 minutes while the images build and the containers restart.

## What this release changes

| Area | Change | Action |
|---|---|---|
| Database | 4 **additive** migrations: `20261118120000_plan_final_approval_level`, `20261118130000_plan_item_pending_approval`, `20261118140000_group_audits`, `20261118150000_workspace_documents`. No drops, deletes or truncates. | Step 5 |
| Roles | Auditors, Head of Internal Audit and Director General are re-defined (who sees what, who is told what). Removes `engagement:read_all`, `engagement:notify_lifecycle` from auditors and the DG, and `finding:read_all` from auditors and the DG. | Step 7 (roles script) |
| Application | Sole-auditor flow; Head sees and is told about every audit; DG limited to the audit sent to sign; reassigning an audit when someone is away; GBB document template for working papers and reports (Word + PDF); new Help Centre and role guides (PDFs in the web image). | Step 4 |
| Dependencies | New frontend packages (TipTap editor, `docx`), installed automatically by the image build. | Nothing |
| `.env` | **No new required variables.** `DYNAFIN_*` are optional and off by default. | Nothing |
| nginx | No change. | Nothing |

## Do NOT

- Do **not** run `db-seed` (it resets the super-admin password and configuration).
- Do **not** pass `--sync-permissions` to `deploy-update.sh` for this release. The roles are applied by the dedicated roles script in Step 7, which never touches users, passwords or 2FA.

## Steps

### 1. Log in and go to the app

```bash
ssh ams_vm@197.159.79.65
cd /opt/iams/app
git log --oneline -1          # WRITE THIS DOWN: it is your rollback point
```

### 2. Backup first

```bash
/opt/iams/backup.sh
ls -lh /opt/iams/backups | tail -3     # today's iams-YYYY-MM-DD.bak and uploads-YYYY-MM-DD.tgz must exist and not be empty
```

### 3. Pull the code

```bash
git pull origin dev
git log --oneline -3                   # the top commit should be "fix(documents): a sole auditor's completed working paper ..." (c74b0c6) or newer
```

### 4. Build, migrate, restart (the script does all of this)

```bash
bash deploy/deploy-update.sh --skip-backup      # you took the backup in step 2
```

It builds the images (including `--profile ops`), applies the 4 migrations, restarts the containers and waits for the API health check. You should see `Applying migration ...` for the four migrations above and finally `Deployment complete.`

If you prefer the manual form:

```bash
set -a && source .env && set +a
docker compose -f docker-compose.prod.yml --profile ops build
docker compose -f docker-compose.prod.yml --profile ops run --rm db-migrate
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

### 5. Check the API is healthy

```bash
docker compose -f docker-compose.prod.yml logs --tail=40 iams-api
curl -s -o /dev/null -w "%{http_code}\n" https://audit.galaxybackbone.com.ng/     # expect 200
```

### 6. Preview the role changes (read-only)

```bash
docker compose -f docker-compose.prod.yml --profile ops run --rm \
  -v "$PWD/scripts:/app/scripts:ro" \
  db-migrate npx ts-node scripts/seed-gbb-audit-roles.ts
```

Read the output. It lists each role as `CREATE` or `UPDATE` with what it will add or remove, and how many people hold it. Expected on this release: the auditor roles and `dg` lose `finding:read_all`, `engagement:read_all`, `engagement:notify_lifecycle`; the Head keeps them. If it stops with a message about a role that already exists and was not created by the script, **do not continue**: send the message to the development team.

### 7. Apply the role changes

```bash
docker compose -f docker-compose.prod.yml --profile ops run --rm \
  -v "$PWD/scripts:/app/scripts:ro" \
  db-migrate npx ts-node scripts/seed-gbb-audit-roles.ts --execute --confirm=GBB-ROLES
```

Then **everybody must sign out and sign in again** (permissions are stored in the login session).

### 8. Quick check after signing in again

| Sign in as | You should see |
|---|---|
| Head of Internal Audit | Every engagement and finding. A notice for each new audit, with the people named. |
| A Financial / System / Compliance Auditor | Only the audits they are part of, and only those audits' findings. |
| Director General | No audit notices. Only the "needs approval" notice, and only the audit sent to sign (read-only). |
| Any auditor, **Manage** on an audit's Overview tab | Substitute / Reassign form if they lead or manage a team audit; an explanation instead on a sole-auditor audit. |

Also open one working paper or report and download the Word and PDF: it should have the GBB cover, green rules and "Internal Use Only" header. In Word, choose **Yes** when asked to update the table of contents.

## If something goes wrong

1. **API will not start / health check fails:** `docker compose -f docker-compose.prod.yml logs --tail=150 iams-api`. Send the output to the development team.
2. **Roll the code back:** `git checkout <the commit you wrote down in step 1>`, then `bash deploy/deploy-update.sh --skip-backup`. The migrations are additive, so the older code runs against the newer database.
3. **Roll the roles back:** restore today's backup `/opt/iams/backups/iams-YYYY-MM-DD.bak` (ask the development team to assist).
