# IAMS — VPS Deployment Runbook (Docker)

> Full flow from first SSH login to the system being live on the organization's VPS.
> Assumes the application is **already dockerized**. This runbook uses these names —
> align them with your actual Dockerfiles/compose file if they differ:
>
> | Service | Image / build context | Container port |
> |---|---|---|
> | `iams-api` | backend (`audit-system/`, Node + Express) | 3000 |
> | `iams-web` | frontend (`audit-system/frontend/`, Next.js) | 3001 |
> | `nginx` | reverse proxy + TLS termination | 80 / 443 |
> | `redis` *(optional)* | cache/session store when `CACHE_DRIVER=redis` | 6379 (internal only) |
>
> **Database is NOT a container in this runbook.** SQL Server is hosted by GBB
> (per project scope). The API reaches it via `DATABASE_URL`. If you must run
> SQL Server in Docker instead, see [Appendix A](#appendix-a--sql-server-in-docker).

---

## 0. Before you SSH — things to have ready

| Item | Why | Who provides |
|---|---|---|
| VPS IP + initial credentials (root or sudo user) | login | GBB IT |
| DNS name (e.g. `iams.gbb.internal` or public FQDN) or agreement to use the raw IP | TLS + cookie domain | GBB IT |
| TLS certificate + key (GBB internal CA) **or** permission to use Let's Encrypt (public DNS only) | HTTPS is mandatory — auth cookies are httpOnly/secure | GBB IT |
| SQL Server host, port, database name, login (with `db_owner` during migration; reduced afterwards) | `DATABASE_URL` | GBB DBA |
| Firewall rule: VPS → SQL Server port 1433 | connectivity | GBB network team |
| SMTP host/port/credentials (relay allowed from the VPS IP) | password reset, 2FA email OTP, notifications | GBB IT |
| Entra ID app registration: redirect URI updated to `https://<host>/api/auth/callback` | SSO login | whoever owns the Azure tenant |
| Docker registry access **or** git deploy key for this repo | pulling images / building on the VPS | you |

---

## 1. SSH login and server hardening (once)

```bash
ssh root@<VPS_IP>            # or the initial user GBB gave you
```

### 1.1 Create a deploy user, lock down SSH

```bash
adduser iams
usermod -aG sudo iams

# Put your public key on the new user
mkdir -p /home/iams/.ssh
cp ~/.ssh/authorized_keys /home/iams/.ssh/   # or paste your key
chown -R iams:iams /home/iams/.ssh
chmod 700 /home/iams/.ssh && chmod 600 /home/iams/.ssh/authorized_keys
```

Edit `/etc/ssh/sshd_config`:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
systemctl restart sshd
# KEEP THIS SESSION OPEN and confirm you can `ssh iams@<VPS_IP>` in a second terminal
```

### 1.2 Firewall — only SSH and HTTPS in

```bash
apt update && apt install -y ufw fail2ban unattended-upgrades
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp        # only needed for Let's Encrypt HTTP-01; remove if using GBB certs
ufw allow 443/tcp
ufw enable
```

> Ports 3000/3001/6379 are **never** exposed publicly — containers talk over an
> internal Docker network and only nginx publishes ports. Note that Docker
> published ports (`-p`) bypass UFW, which is exactly why nothing except nginx
> gets a `ports:` mapping.

`fail2ban` defaults protect sshd out of the box. `unattended-upgrades` keeps
security patches flowing:

```bash
dpkg-reconfigure -plow unattended-upgrades
```

### 1.3 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker iams
# log out/in as iams for the group to apply
docker --version && docker compose version
```

From here on, work as `iams`, not root.

---

## 2. Get the application onto the VPS

Either pull prebuilt images from your registry, or clone and build on the box:

```bash
sudo mkdir -p /opt/iams && sudo chown iams:iams /opt/iams
cd /opt/iams
git clone <repo-url> app        # via deploy key (read-only)
cd app
```

Expected persistent paths on the host (created below):

```
/opt/iams/app            # repo / compose file
/opt/iams/uploads        # document storage  (STORAGE_PROVIDER=local)
/opt/iams/logs           # winston file logs (prod JSON transport)
/opt/iams/backups        # local backup staging before offsite copy
```

```bash
mkdir -p /opt/iams/uploads /opt/iams/logs /opt/iams/backups
```

---

## 3. Production environment file

**Never reuse the development `.env`.** It has been committed to git history —
treat every secret in it as burned. Generate fresh ones:

```bash
# three independent secrets — run three times
openssl rand -hex 64    # JWT_SECRET
openssl rand -hex 64    # JWT_REFRESH_SECRET
openssl rand -hex 32    # MFA_ENCRYPTION_KEY (AES-256-GCM — must be 32 bytes hex)
```

Create `/opt/iams/app/.env` (`chmod 600 .env`, owner `iams`):

```ini
# ── App ────────────────────────────────────────────────
APP_NAME=IAMS
NODE_ENV=production
PORT=3000
API_VERSION=v1
APP_URL=https://<host>            # download URLs are built from this — must be the public URL
FRONTEND_URL=https://<host>       # password-reset email links point here

# ── Database (GBB SQL Server) ──────────────────────────
DATABASE_URL="sqlserver://<db-host>:1433;database=iams;user=<user>;password=<pw>;encrypt=true;trustServerCertificate=false"

# ── Auth ───────────────────────────────────────────────
JWT_SECRET=<fresh 64-byte hex>
JWT_REFRESH_SECRET=<fresh 64-byte hex>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
MFA_MANDATORY=true
MFA_ENCRYPTION_KEY=<fresh 32-byte hex>
MFA_ISSUER=GBB IAMS

# ── SSO (Entra ID) ─────────────────────────────────────
OIDC_PROVIDER=azure_ad
AZURE_AD_TENANT_ID=<tenant>
AZURE_AD_CLIENT_ID=<client>
AZURE_AD_CLIENT_SECRET=<fresh secret from Azure — rotate the old one>
AZURE_AD_REDIRECT_URI=https://<host>/api/auth/callback   # the FRONTEND callback (BFF flow)
DIRECTORY_SYNC_ENABLED=true
SSO_DEFAULT_ROLE=viewer
SSO_REQUIRE_IDP_MFA=true

# ── Email ──────────────────────────────────────────────
SMTP_HOST=<gbb-relay>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<user>
SMTP_PASSWORD=<pw>
EMAIL_FROM="IAMS <iams@gbb.gov.ng>"

# ── Storage — LOCAL DISK (deploy decision) ─────────────
STORAGE_PROVIDER=local            # dev .env said aws_s3 — do NOT copy that
STORAGE_LOCAL_PATH=/data/uploads  # container path; volume-mounted below

# ── Cache ──────────────────────────────────────────────
CACHE_DRIVER=redis                # or "memory" if you skip the redis container
REDIS_URL=redis://redis:6379

# ── Rate limiting / logging ────────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=300
LOG_LEVEL=info
LOG_FORMAT=json
```

Frontend env (`/opt/iams/app/frontend/.env.production` or compose `environment:`):

```ini
NEXT_PUBLIC_API_URL=https://<host>/api/v1
INTERNAL_API_URL=http://iams-api:3000/api/v1   # container-to-container, no TLS hop
```

Checks the app does for you at boot — don't fight them:
- `verifyStorageReady()` fails fast if the uploads volume isn't writable.
- The escalation-matrix check logs a warning if configured escalation roles have no active holders.
- `requireEnv` crashes on missing mandatory vars in production. A crash-loop at first start is almost always a missing env var — `docker compose logs iams-api` tells you which.

---

## 4. Bring the stack up

The compose file should follow this shape (align with your actual one):

```yaml
services:
  iams-api:
    image: iams-api:<tag>          # or build: .
    env_file: .env
    volumes:
      - /opt/iams/uploads:/data/uploads
      - /opt/iams/logs:/app/logs
    networks: [iams]
    restart: unless-stopped
    deploy: { replicas: 1 }        # MUST stay 1 — see §6 background jobs

  iams-web:
    image: iams-web:<tag>
    environment:
      - INTERNAL_API_URL=http://iams-api:3000/api/v1
      - NEXT_PUBLIC_API_URL=https://<host>/api/v1
    networks: [iams]
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes: [redis-data:/data]
    networks: [iams]
    restart: unless-stopped
    # NO ports: — internal only

  nginx:
    image: nginx:stable-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /opt/iams/certs:/etc/nginx/certs:ro
    networks: [iams]
    restart: unless-stopped
    depends_on: [iams-api, iams-web]

networks: { iams: {} }
volumes: { redis-data: {} }
```

```bash
cd /opt/iams/app
docker compose pull        # or: docker compose build
docker compose up -d
docker compose ps          # everything "running"
```

### 4.1 Database migrate + seed (first deploy)

```bash
# Apply all migrations (includes 20260705193755_add_engagement_time_tracking)
docker compose exec iams-api npx prisma migrate deploy

# Seed roles/permissions/templates/config — idempotent upserts
docker compose exec iams-api npx prisma db seed
```

**Immediately after seeding, deal with the test users.** The seed creates
demo accounts (`admin@example.com`, `auditor@gbb.gov.ng`, …) that exist for
smoke-testing only:

1. Log in as the super admin, change its password to a strong unique one.
2. Deactivate every other seeded user (Users → deactivate), or reassign them
   to real GBB staff. Real users arrive via Entra SSO + group mappings
   (Settings → Directory).

---

## 5. Nginx — TLS termination and routing

`deploy/nginx.conf`:

```nginx
server {
    listen 80;
    server_name <host>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name <host>;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Security headers (helmet covers the API; these cover the frontend)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Uploads: multer caps at 50 MB in-app; nginx must not cut it off first
    client_max_body_size 60m;

    # Backend API — direct (used by the BFF proxy and any API clients)
    location /api/v1/ {
        proxy_pass http://iams-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;          # rate limiter keys on this
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 120s;                          # PDF/DOCX export can take a while
    }

    # Everything else — Next.js (includes /api/auth/* BFF and /api/proxy/*)
    location / {
        proxy_pass http://iams-web:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Certificates:
- **GBB internal CA (likely):** drop `fullchain.pem`/`privkey.pem` into `/opt/iams/certs`, `chmod 600`.
- **Public DNS:** `certbot certonly --standalone -d <host>` (stop nginx first or use webroot), then symlink into `/opt/iams/certs`. Add a renewal cron: `0 3 * * 1 certbot renew --deploy-hook "docker compose -f /opt/iams/app/docker-compose.yml restart nginx"`.

Because the API sits behind a proxy, Express must trust it so the per-user rate
limiter sees real client IPs — confirm the app sets `trust proxy` (or set
`app.set('trust proxy', 1)` if it doesn't).

---

## 6. Background jobs — what runs and the one rule

Jobs run **in-process inside `iams-api`** via node-cron (persisted to
`scheduled_jobs` / `scheduled_job_runs`). Two consequences:

1. **Exactly one `iams-api` replica.** Scale it out and every job runs N times.
   Jobs are written to be idempotent, but N notification-queue processors will
   still race. If you ever need horizontal scale, split a dedicated worker
   container first.
2. **If the API container is down, jobs don't run.** `restart: unless-stopped`
   plus the health check below covers this.

| Job key | Schedule | What breaks if it stops |
|---|---|---|
| `BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE` | every minute | **all email + in-app notifications** (they're queued, not sent inline) |
| `BG:TOKEN:CLEANUP:HOURLY` | hourly | stale refresh tokens accumulate |
| `BG:AUDIT:REMINDER:DAILY` | daily | SLA reminder emails |
| `BG:WORKFLOW:ESCALATION:HOURLY` | hourly | overdue/stalled escalations |
| `BG:AUDIT:RECONCILE:STATUS:HOURLY` | hourly | engagement auto-advance safety net |
| `BG:USER:MFA_GRACE_REMINDER:DAILY` | daily | 2FA enrolment nudges |
| `BG:INTEGRATION:DIRECTORY:SYNC:DAILY` | nightly | AD role reconcile + deprovision (needs `DIRECTORY_SYNC_ENABLED=true`) |
| `BG:DOCUMENT:VERSION:PRUNE:WEEKLY` | Sun 03:00 | old document versions accumulate (opt-in config) |
| `BG:RETENTION:PURGE:WEEKLY` | Sun 04:00 | **NDPR retention enforcement** — logs/notifications past retention are not purged |
| `BG:LOG:ARCHIVE:WEEKLY` | weekly | (warehouse push still TODO) |

Monitor them: `GET /api/v1/jobs` (permission `job:read`) shows last-run status;
each job can be disabled per-row via `scheduled_jobs.is_active`.

---

## 7. Backups

Three things hold state. Everything else is rebuildable from the repo + registry.

| What | Where | Method | Cadence | Retention |
|---|---|---|---|---|
| **SQL Server database** | GBB DB host | GBB DBA native backups (FULL daily + LOG every 15–60 min). Confirm in writing that `iams` is in their backup set. | daily / sub-hourly | per GBB policy (≥ 35 days) |
| **`/opt/iams/uploads`** | VPS | restic (encrypted, deduplicated) to offsite/NAS target | daily | 30 daily / 12 monthly |
| **`.env` + certs + compose + nginx.conf** | VPS | encrypted copy (age/gpg) stored with restic or in GBB's secret store | on every change | last 5 versions |

The DB and uploads must be restored **as a pair** — document rows point at
files by `storage_path`. A DB restored to Monday with Tuesday's uploads is fine
(orphan files); Tuesday's DB with Monday's uploads means broken downloads.
Back up uploads at the same cadence as the DB.

### 7.1 Uploads backup (restic example)

```bash
apt install -y restic
restic init --repo sftp:backup@<backup-host>:/backups/iams   # once; store the repo password in GBB's vault

cat >/opt/iams/backup-uploads.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
export RESTIC_REPOSITORY=sftp:backup@<backup-host>:/backups/iams
export RESTIC_PASSWORD_FILE=/opt/iams/.restic-pass   # chmod 600
restic backup /opt/iams/uploads /opt/iams/app/.env /opt/iams/certs
restic forget --keep-daily 30 --keep-monthly 12 --prune
EOF
chmod 700 /opt/iams/backup-uploads.sh

# 02:30 daily, before the weekly retention purge windows
(crontab -l 2>/dev/null; echo "30 2 * * * /opt/iams/backup-uploads.sh >> /opt/iams/logs/backup.log 2>&1") | crontab -
```

### 7.2 Restore drill (do this once before go-live, then quarterly)

```bash
restic restore latest --target /tmp/restore-test --include /opt/iams/uploads
# pick any file, compare checksums with the live copy
```

Ask the GBB DBA to demonstrate a point-in-time restore of the `iams` database
to a scratch DB once before go-live. **A backup that has never been restored is
a hope, not a backup.**

---

## 8. Go-live verification

```bash
# 1. API alive
curl -sk https://<host>/api/v1/../../health   # or: curl -sk https://<host>/health via nginx if routed
docker compose exec iams-api wget -qO- http://localhost:3000/health

# 2. Boot log shows storage + no escalation warnings
docker compose logs iams-api | grep -E "storage verified|Escalation matrix|IAMS server started"
```

Then in a browser:

1. `https://<host>/login` loads over TLS (padlock, no mixed content).
2. Local login with the (re-passworded) super admin → 2FA enrolment prompt appears (`MFA_MANDATORY=true`).
3. "Sign in with Microsoft" completes and lands on the dashboard (validates the Entra redirect URI).
4. Upload a document to any engagement, then download it — round-trips the local storage volume.
5. Trigger a password-reset email — validates SMTP + `FRONTEND_URL` link.
6. `GET /api/v1/jobs` — all jobs registered, first runs green after an hour.
7. Analytics → "Committee pack (PDF)" downloads (validates pdfmake in the container image).
8. Reboot the VPS once: `sudo reboot`. Everything must come back by itself (`restart: unless-stopped` + Docker's systemd unit).

---

## 9. Security checklist (sign off before announcing the URL)

- [ ] **All secrets regenerated** — nothing from the dev `.env` reused (it's in git history). Azure client secret rotated. `git rm --cached .env` committed in the repo.
- [ ] `.env` on the VPS is `chmod 600`, owner `iams`; never in the image (`.dockerignore` covers `.env`, `uploads/`, `logs/`).
- [ ] SSH: key-only, no root login, fail2ban active.
- [ ] UFW: only 22/443 (80 only if certbot needs it). No container publishes any other port.
- [ ] TLS ≥ 1.2, HSTS on. Cookies are httpOnly and flow only over HTTPS.
- [ ] `NODE_ENV=production` (helmet, JSON logs, strict env validation) and rate limiting **not** disabled.
- [ ] `MFA_MANDATORY=true`, `SSO_REQUIRE_IDP_MFA=true`.
- [ ] Seeded test users deactivated; super admin re-passworded; real access flows through Entra group mappings.
- [ ] DB login used by the app downgraded from `db_owner` to `db_datareader`+`db_datawriter` (+ EXECUTE) after migrations; migrations run with a separate elevated login.
- [ ] Backups running (check `/opt/iams/logs/backup.log` after night one) and one restore proven.
- [ ] Docker updates: `docker compose pull && docker compose up -d` scheduled monthly maintenance window; base images rebuilt on security advisories.
- [ ] Audit trail intact: mutate something, confirm it appears in Audit Logs UI (`audit_logs` table) — this is a compliance requirement, not a nice-to-have.

---

## 10. Day-2 operations

### Deploying an update

```bash
cd /opt/iams/app
git pull                                   # or bump the image tag
docker compose build                       # skip if pulling from registry
docker compose exec iams-api npx prisma migrate deploy   # BEFORE swapping the API
docker compose up -d                       # recreates changed containers
docker compose logs -f iams-api            # watch boot: storage check, jobs registered
```

Seed only when a release note says so (new permissions/templates) — it's
idempotent, but don't run it reflexively.

### Rollback

```bash
docker compose down iams-api iams-web
# pin previous image tags in compose, then:
docker compose up -d
```

Migrations are forward-only — never roll back the schema in place. If a bad
migration ships, restore the DB from backup (that's what §7 buys you) or ship
a corrective forward migration.

### Watching it

```bash
docker compose ps                       # container state
docker compose logs -f --tail=200 iams-api
df -h /opt/iams                         # uploads + logs growth
docker system df                        # image/layer bloat; `docker system prune` in maintenance windows
```

Add an uptime check (GBB monitoring or a simple cron + mail) against
`https://<host>/health`. Watch disk: the two consumers are `/opt/iams/uploads`
(grows with real usage; version-prune job caps it once enabled in Settings) and
Docker images (prune old ones after deploys).

### Troubleshooting quick table

| Symptom | First check |
|---|---|
| API crash-loops at start | `docker compose logs iams-api` — missing env var (`requireEnv`) or DB unreachable |
| "Local document storage is not writable" | volume mount vs `STORAGE_LOCAL_PATH`; ownership of `/opt/iams/uploads` |
| Uploads fail at ~50 MB | nginx `client_max_body_size` vs multer cap |
| No emails at all | queue processor job status at `/api/v1/jobs`, then `email_logs` table, then SMTP relay allow-list |
| SSO redirect error | Entra redirect URI must be exactly `https://<host>/api/auth/callback` |
| Download links say localhost | `APP_URL` wrong in `.env` |
| Everyone rate-limited together | `trust proxy` not set / `X-Real-IP` not forwarded |
| Jobs never run | replicas > 1 collision or container restarted mid-schedule — check `scheduled_job_runs` |

---

## Appendix A — SQL Server in Docker

Only if GBB does **not** provide a database host. Add to compose:

```yaml
  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - MSSQL_SA_PASSWORD=<strong pw — not the app login>
    volumes:
      - /opt/iams/mssql:/var/opt/mssql
    networks: [iams]
    restart: unless-stopped
    # NO ports: — internal only
```

Then `DATABASE_URL` host becomes `mssql:1433`, and **you** own backups:

```bash
# nightly native backup inside the container, staged to /opt/iams/backups, picked up by restic
docker compose exec mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<pw>' -C \
  -Q "BACKUP DATABASE iams TO DISK='/var/opt/mssql/iams.bak' WITH INIT, COMPRESSION"
docker compose cp mssql:/var/opt/mssql/iams.bak /opt/iams/backups/iams-$(date +%F).bak
```

Create a dedicated app login (not `sa`) with `db_datareader`/`db_datawriter`/EXECUTE
on the `iams` database, and run migrations with a separate elevated login.
