# Deploying the System Audit Toolkit release (2026-09-28)

Release commit: **`12ec8c3`** on `dev` — *feat(system-audit): add system audit toolkit*.
This is the step-by-step for the GBB VPS. It follows `VPS_DEPLOYMENT_RUNBOOK.md` §10
("Deploy an update") with the extra steps this release needs. Run the steps in order.

**Time:** about 20–30 minutes. Users see roughly 1–2 minutes of downtime while the
containers restart (step 8).

---

## What this release changes on the server

| Area | Change | Action needed |
|---|---|---|
| Database | 2 new migrations: new tables (`system_logs`, `system_audit_runs`, `system_audit_exceptions`, `access_review_items`, `security_tests`, `security_test_assets`, `system_documents`) and one new optional column (`risk_register.business_objective`). **Additive only** — nothing is dropped or rewritten. | Step 5 |
| Permissions | 12 new permissions and new grants for the audit roles | Step 6 |
| Control library | GDPR and SOX ITGC frameworks, 32 new controls | Step 7 |
| Background jobs | New daily job `BG:SYSAUDIT:MONITORING:DAILY` at 06:30 **container time (UTC)** = 07:30 Lagos time | Nothing |
| Dependencies | `winston-transport` (already installed transitively; now declared) | Nothing — the build installs it |
| `.env` | **No new variables** | Nothing |
| nginx | No change (upload limit is already 60 MB; the app caps extracts at 50 MB) | Nothing |

---

## ⚠️ Do **not** run `db-seed` for this release

The runbook says to re-run `db-seed` when a release adds permissions. **Don't** — the
full seed:

- **resets the super-admin password back to the default** printed in the runbook, and
- rebuilds the standard roles' permission sets.

Use the targeted script in step 6 instead. It only adds the new permissions to the
roles and never touches any user, password, or 2FA setting.

---

## Steps

### 1. Log in and go to the app

```bash
ssh ams_vm@197.159.79.65
cd /opt/iams/app
```

### 2. Take a backup first

```bash
/opt/iams/backup.sh
ls -lh /opt/iams/backups | tail -3     # today's iams-YYYY-MM-DD.bak and uploads-YYYY-MM-DD.tgz
```

Don't continue until both files for today are there.

### 3. Pull the new code

```bash
git pull origin dev
git log --oneline -1
```

The last line must start with **`12ec8c3 feat(system-audit)`** (or a later commit).

### 4. Build the new images — including the database-tools image

```bash
source .env
docker compose -f docker-compose.prod.yml --profile ops build
```

> The `--profile ops` matters. Without it the `db-migrate` tools image is **not**
> rebuilt, still contains the old migration files, and step 5 would quietly report
> "no pending migrations" while the new tables never get created.

### 5. Apply the database migrations

```bash
docker compose -f docker-compose.prod.yml --profile ops run --rm db-migrate
```

You should see both of these, then `All migrations have been successfully applied.`:

```
Applying migration `20260928104515_add_system_logs_and_risk_objective`
Applying migration `20260928105111_add_system_audit_toolkit`
```

### 6. Add the new permissions to the roles (safe — no users touched)

```bash
docker compose -f docker-compose.prod.yml --profile ops run --rm \
  -v "$PWD/scripts:/app/scripts:ro" \
  db-migrate npx ts-node scripts/seed-role-permissions.ts
```

Expected: `Permissions ensured: 140`, then one `[updated]` line per role.

> The tools image doesn't contain the `scripts/` folder, which is why it's mounted
> in with `-v`.
>
> **One thing to know:** this script sets each *standard* role (`audit_manager`,
> `audit_lead`, `auditor`, `auditee`, `director`, `cae`, `audit_committee`,
> `viewer`, `super_admin`) to its standard permission list. If anyone at GBB
> changed a standard role's permissions in **Settings → Role Management**, those
> edits are reset — note them first and re-apply afterwards. Custom roles with
> other names are not touched.

### 7. Load the new controls into the Control Library

```bash
docker compose -f docker-compose.prod.yml --profile ops run --rm \
  -v "$PWD/scripts:/app/scripts:ro" \
  db-migrate npx ts-node scripts/seed-compliance-controls.ts
```

Expected: `Upserted 14 frameworks.` and `Upserted 64 controls.`

> This also refreshes the wording of the built-in controls. If GBB edited the text
> of a built-in control in the Control Library, that edit is overwritten. Controls
> GBB added themselves are not touched.

### 8. Start the new version

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=150 iams-api
```

All five containers should show `running` / `healthy`. In the `iams-api` log look for:

- `IAMS server started`
- `Background job registered … "jobKey":"BG:SYSAUDIT:MONITORING:DAILY"`

### 9. Check it works

```bash
docker compose -f docker-compose.prod.yml exec iams-api wget -qO- http://localhost:3000/health
```

Then in the browser at `https://audit.galaxybackbone.com.ng`:

1. **Log out and log back in.** New permissions travel in the login token; without
   logging out they appear on their own within about 15 minutes.
2. The sidebar shows a **System Audit** group, and **Toolkit overview** lists the
   seven activities.
3. **System Audit → Continuous monitoring → Run checks now** (super admin or audit
   manager). The IAMS checks run; the Entra ID check runs because
   `DIRECTORY_SYNC_ENABLED=true`; IMOC shows "not connected" unless IMOC is enabled.
4. **Event monitoring** shows today's sign-ins, including your own.
5. **Risk Register**, **Findings**, and **Audit Logs** show an **Export** button.

> **About test uploads on the live system:** analysis runs are permanent audit
> evidence — they cannot be deleted. The files in `docs/system-audit-samples/` are
> fictional. For a live check, either use a real export, or put **"TEST"** in the
> title so nobody mistakes it for real results.

---

## What users will notice

- A new **System Audit** menu: toolkit overview, Data analytics, Access reviews,
  Event monitoring, Continuous monitoring, Security testing, System documentation.
- A new **System audit** tab on every engagement.
- A **Business objective** field on risks.
- **Auditors** can now open the Users page and Audit Logs (read-only) and export
  findings and risks. **Audit leads** can generate review reports.
- System-audit administrators (`sysaudit:admin`, e.g. audit managers) get an in-app
  notification when the daily monitoring finds new high or critical exceptions.
- High/medium badges and severity bars now show their orange/yellow colours
  (they were colourless before because of a styling bug).

---

## If something goes wrong

**The API won't start** — `docker compose -f docker-compose.prod.yml logs iams-api`.
The usual causes are in the runbook's troubleshooting table.

**Roll back the code** — the migrations only add tables and one optional column, so
the previous version runs fine against the new database. No database restore is
needed just to roll back:

```bash
cd /opt/iams/app
git checkout e212e72
source .env
docker compose -f docker-compose.prod.yml --profile ops build
docker compose -f docker-compose.prod.yml up -d
```

To return to the new release later: `git checkout dev && git pull origin dev`, then
steps 4 and 8.

**Restore the backup** only if data was damaged — restore the database *and* the
uploads from step 2 together, as described in the runbook §7.
