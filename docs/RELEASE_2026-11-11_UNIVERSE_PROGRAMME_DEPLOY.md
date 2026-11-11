# Deploying the Audit Universe & Audit Programme Enhancements (2026-11-11)

Release branch: **`dev`** (addresses the `10/11/2026` live user concerns on Audit Universe & Audit Programme, plus working Universe search/frequency filters).
This guide follows `VPS_DEPLOYMENT_RUNBOOK.md` §10 ("Deploy an update") with the exact steps for this release on the GBB VPS (`/opt/iams/app`).

**Estimated downtime:** ~1–2 minutes while containers restart after image build.

---

## What this release changes on the server

| Area | Change | Action needed |
|---|---|---|
| Database | 1 additive migration (`20261111140000_add_universe_additional_owners`) adding `[dbo].[audit_universe_owners]` for multi-owner selection on Audit Universe items. **Additive only** — existing Audit Universe items, primary `owner_id`, existing Audit Plans, Plan Items, and Engagements remain intact. *(If the server has not yet deployed commits from Oct/Nov, `prisma migrate deploy` also applies `20261012130000_add_imoc_ingestion_tables` and/or `20261105120000_add_projectplus_entity_links` automatically.)* | Step 5 |
| Permissions | Grants `universe:delete` to `audit_manager` in `prisma/seed.ts` (the `universe:delete` permission slug already exists in the seeded permission catalogue). | Step 6 |
| Application (`iams-api` & `iams-web`) | Multi-owner support for Audit Universe items, `On-Demand` audit frequency + planning recommendation logic, strict Audit Universe → Audit Programme population (`GET /plans/:id/universe-candidates`, `POST /plans/:id/items/bulk`, `PUT /plans/:id/items/:itemId`), active-universe guards, grandfathered edit/delete behavior for pre-existing unlinked plan items, safe Universe entity deletion with referential-integrity guards, and server-side search/frequency filtering on Audit Universe. | Step 4 & Step 7 |
| Dependencies | **No new npm packages** | Nothing |
| `.env` | **No new required variables** (`PROJECTPLUS_ENABLED` defaults to `false` if present from earlier commits) | Nothing |
| nginx | **No change** (keep your live `/opt/iams/app/deploy/nginx.conf` server name intact) | Nothing |

---

## ⚠️ Do **not** run `db-seed` on the live server

`db-seed` resets the built-in `superadmin@gbb.gov.ng` password back to the initial runbook default and resets configuration.
Use **Option A** (`scripts/seed-role-permissions.ts`, which never touches users, passwords, or 2FA) **or Option B** (a 10-second click in the Admin UI) in Step 6.

---

## Quick Run (Automated Script)

After pushing to `origin/dev`, SSH into the VPS and run:

```bash
ssh ams_vm@197.159.79.65
cd /opt/iams/app
git pull origin dev
bash deploy/deploy-update.sh --sync-permissions
```

*(Omit `--sync-permissions` if you prefer **Option B** below to keep custom UI edits on standard roles and want to toggle `universe:delete` for Audit Manager manually in **Settings → Role Management**.)*

---

## Manual Step-by-Step Commands

If you prefer running each command yourself:

### 1. Log in and go to the app

```bash
ssh ams_vm@197.159.79.65
cd /opt/iams/app
```

### 2. Take a backup first

```bash
/opt/iams/backup.sh
ls -lh /opt/iams/backups | tail -3     # confirm today's iams-YYYY-MM-DD.bak and uploads-YYYY-MM-DD.tgz
```

Do **not** continue until both files for today exist and are non-empty.

### 3. Pull the new code

```bash
git pull origin dev
git log --oneline -2
```

### 4. Build the new images — including the database-tools image

```bash
set -a && source .env && set +a
docker compose -f docker-compose.prod.yml --profile ops build
```

> **`--profile ops` is required.** Without it, `iams-db-tools:latest` (`db-migrate`) keeps old migration files and will skip `20261111140000_add_universe_additional_owners`.

### 5. Apply the database migrations

```bash
docker compose -f docker-compose.prod.yml --profile ops run --rm db-migrate
```

You should see:

```text
Applying migration `20261111140000_add_universe_additional_owners`
All migrations have been successfully applied.
```

### 6. Grant `universe:delete` to `Audit Manager`

Pick **either** Option A or Option B:

- **Option A — Automated sync script (recommended if GBB has not customized standard roles in the UI):**

  ```bash
  docker compose -f docker-compose.prod.yml --profile ops run --rm \
    -v "$PWD/scripts:/app/scripts:ro" \
    db-migrate npx ts-node scripts/seed-role-permissions.ts
  ```

  Expected output: `Permissions ensured: 146`, followed by `[updated]` / `[CREATED]` lines per standard role (including `audit_manager` and `director_general`).

  > **Note:** Like previous releases, `seed-role-permissions.ts` resets the permission lists of *standard* built-in role names (`super_admin`, `audit_manager`, `audit_lead`, `auditor`, `auditee`, `director`, `director_general`, `cae`, `audit_committee`, `viewer`) to `prisma/seed.ts` defaults. Custom-named roles are untouched.

- **Option B — Toggle directly in the web UI (recommended if GBB already customized standard role permissions in Settings):**

  Skip the script, finish Steps 7–8, log in as Super Admin at **Settings → Role Management → `audit_manager`**, enable **Audit → `universe:delete`**, and save.

### 7. Start the updated containers

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=150 iams-api
```

All five services (`mssql`, `iams-api`, `iams-web`, `redis`, `nginx`) should be `running` / `healthy`, with `IAMS server started` in the `iams-api` logs.

### 8. Verify health and live features

```bash
docker compose -f docker-compose.prod.yml exec iams-api wget -qO- http://localhost:3000/health
```

Then verify in the browser (`https://audit.galaxybackbone.com.ng`):

1. **Log out and log back in** (or wait ~15 minutes for JWT refresh) so `Audit Manager` picks up `universe:delete` in the access token.
2. **Audit Universe → New / Edit Entity**: verify multiple owners can be selected under **Audit Owners**, **On-Demand** is available under **Audit Frequency**, and the Search input + Frequency filter work cleanly.
3. **Audit Universe → Delete**: verify an Audit Manager can delete an unused Universe item (after confirmation), and is blocked cleanly with an explanation if the item is referenced by a plan item or engagement.
4. **Audit Programme (Plans) → Add Items from Universe**: verify bulk population & single-item addition pull strictly from active Universe entities and show `Already Planned` / `Recommended` indicators.
5. **Audit Programme (Plans) → Edit / Remove Plan Item**: verify Draft/Rejected plans allow editing and removing items, Approved plans protect the programme while allowing **On-Demand / emergency add** of an Audit Universe item (which automatically logs an audit-trail exception note).
6. **Pre-existing Legacy Plan Items**: verify any plan item created before this release that lacks a Universe link shows an **Unlinked (legacy)** indicator, remains editable for scheduling fields (priority, quarter, hours, scope, lead), can be removed in Draft/Rejected plans, and still launches engagements cleanly.

---

## Rollback

Because the database migration only adds `[dbo].[audit_universe_owners]`, the previous release continues to run against the database without restoring a backup:

```bash
cd /opt/iams/app
git checkout f8359f1
set -a && source .env && set +a
docker compose -f docker-compose.prod.yml --profile ops build
docker compose -f docker-compose.prod.yml up -d
```

To restore the database + uploads from Step 2 (only if data was intentionally altered or damaged), follow `VPS_DEPLOYMENT_RUNBOOK.md` §7 as a pair.
