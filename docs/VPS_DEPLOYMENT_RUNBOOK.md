# IAMS — VPS Deployment Runbook (Docker)

Full flow from first SSH login to the system being live. Every step is a
command you run as-is — the only things you fill in yourself are marked
`# fill in`. Run the whole thing from top to bottom in one SSH session.

| Service | What | Port |
|---|---|---|
| `mssql` | SQL Server 2022, database of record | 1433 (internal only) |
| `iams-api` | backend (Node + Express) | 3000 (internal only) |
| `iams-web` | frontend (Next.js) | 3001 (internal only) |
| `redis` | cache / session store | 6379 (internal only) |
| `nginx` | reverse proxy + TLS termination | 80 / 443 (published) |

Only `nginx` publishes ports. Everything else talks over the internal Docker
network `iams`.

---

## 0. Before you SSH — have these ready

| Item | Why | Who provides |
|---|---|---|
| VPS IP + initial root/sudo credentials | login | GBB IT |
| DNS name (e.g. `iams.gbb.gov.ng`) or agreement to use the raw IP | TLS + cookie domain | GBB IT |
| TLS certificate + key (GBB internal CA), or permission to use Let's Encrypt (public DNS only) | HTTPS — auth cookies are httpOnly/secure | GBB IT |
| SMTP host/port/credentials, relay allowed from the VPS IP | password reset, 2FA OTP, notifications | GBB IT |
| Entra ID app registration, redirect URI set to `https://<host>/api/auth/callback` | SSO login | Azure tenant owner |
| Git deploy key (read-only) for this repo | pulling the code onto the VPS | you |

The database runs in Docker on this VPS (SQL Server container) — no GBB DBA
handoff needed for it. If GBB later wants to host SQL Server themselves
instead, the only change is `DATABASE_URL`'s host in `.env` (§3) — drop the
`mssql` service from the compose file and skip §4's DB-init step.

---

## 1. SSH login and server hardening (once)

```bash
ssh root@<VPS_IP>
```

### 1.1 Create a deploy user, lock down SSH

```bash
adduser iams
usermod -aG sudo iams
mkdir -p /home/iams/.ssh
cp ~/.ssh/authorized_keys /home/iams/.ssh/
chown -R iams:iams /home/iams/.ssh
chmod 700 /home/iams/.ssh && chmod 600 /home/iams/.ssh/authorized_keys

sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd
```

Keep this session open. In a **second terminal**, confirm `ssh iams@<VPS_IP>`
works before you go any further.

### 1.2 Firewall — only SSH and HTTPS in

```bash
apt update && apt install -y ufw fail2ban unattended-upgrades
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp        # only needed for Let's Encrypt HTTP-01; skip if using GBB certs
ufw allow 443/tcp
ufw --force enable
dpkg-reconfigure -f noninteractive unattended-upgrades
```

`fail2ban` protects sshd out of the box, no config needed.

### 1.3 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker iams
```

Log out and back in as `iams` for the group change to apply, then:

```bash
docker --version && docker compose version
```

Do everything from here on as `iams`, not root.

---

## 2. Get the application onto the VPS

```bash
sudo mkdir -p /opt/iams && sudo chown iams:iams /opt/iams
cd /opt/iams
git clone <repo-url> app     # fill in — via the deploy key
cd app

mkdir -p /opt/iams/uploads /opt/iams/logs /opt/iams/backups /opt/iams/mssql
sudo chown -R 1000:1000 /opt/iams/uploads /opt/iams/logs      # iams-api/iams-web run as uid 1000
sudo chown -R 10001:0   /opt/iams/mssql                       # mssql container runs as uid 10001
```

---

## 3. Generate secrets and write `.env`

Fill in the four GBB-provided values, then run the whole block — it generates
every secret and writes `/opt/iams/app/.env` in one shot. Keep this in the
same shell session as §4 (it reuses `MSSQL_SA_PASSWORD` and
`IAMS_DB_PASSWORD`).

```bash
cd /opt/iams/app

# fill in — GBB-provided values
HOST=iams.gbb.gov.ng
SMTP_HOST=smtp.gbb.internal
SMTP_USER=iams@gbb.gov.ng
SMTP_PASSWORD=changeme
AZURE_AD_TENANT_ID=changeme
AZURE_AD_CLIENT_ID=changeme
AZURE_AD_CLIENT_SECRET=changeme

# generated — nothing to fill in below this line
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
MFA_ENCRYPTION_KEY=$(openssl rand -hex 32)
MSSQL_SA_PASSWORD=$(openssl rand -base64 24)
IAMS_DB_PASSWORD=$(openssl rand -base64 24)

cat > .env <<EOF
APP_NAME=IAMS
NODE_ENV=production
PORT=3000
API_VERSION=v1
APP_URL=https://${HOST}
FRONTEND_URL=https://${HOST}

DATABASE_URL="sqlserver://mssql:1433;database=iams;user=iams_app;password=${IAMS_DB_PASSWORD};encrypt=true;trustServerCertificate=true"
MSSQL_SA_PASSWORD=${MSSQL_SA_PASSWORD}
IAMS_DB_PASSWORD=${IAMS_DB_PASSWORD}

JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
MFA_MANDATORY=true
MFA_ENCRYPTION_KEY=${MFA_ENCRYPTION_KEY}
MFA_ISSUER=GBB IAMS

OIDC_PROVIDER=azure_ad
AZURE_AD_TENANT_ID=${AZURE_AD_TENANT_ID}
AZURE_AD_CLIENT_ID=${AZURE_AD_CLIENT_ID}
AZURE_AD_CLIENT_SECRET=${AZURE_AD_CLIENT_SECRET}
AZURE_AD_REDIRECT_URI=https://${HOST}/api/auth/callback
DIRECTORY_SYNC_ENABLED=true
SSO_DEFAULT_ROLE=viewer
SSO_REQUIRE_IDP_MFA=true

SMTP_HOST=${SMTP_HOST}
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=${SMTP_USER}
SMTP_PASSWORD=${SMTP_PASSWORD}
EMAIL_FROM="IAMS <${SMTP_USER}>"

STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=/data/uploads

CACHE_DRIVER=redis
REDIS_URL=redis://redis:6379

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=300
LOG_LEVEL=info
LOG_FORMAT=json
EOF
chmod 600 .env
```

`IAMS_DB_PASSWORD` is the app's DB login — created in §4. `MSSQL_SA_PASSWORD`
is the SQL Server admin password, used only for migrations and backups.
**Never reuse the development `.env`** — it's in git history, treat every
secret in it as burned.

Point nginx at your host:

```bash
sed -i "s/<host>/${HOST}/g" deploy/nginx.conf
```

---

## 4. Bring the stack up

Start the database first, wait for it to be healthy, then create the app's
DB login before starting everything else:

```bash
source .env    # only needed if §3 and this step are different shell sessions

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d mssql

until docker compose -f docker-compose.prod.yml ps mssql | grep -q healthy; do
  sleep 3
done

docker compose -f docker-compose.prod.yml exec mssql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "
CREATE DATABASE iams;
CREATE LOGIN iams_app WITH PASSWORD = '$IAMS_DB_PASSWORD';
"
```

Now bring up the rest and run migrations. Migrations need schema-owner
rights, so they run as `sa`; the app itself runs as the least-privilege
`iams_app` login already baked into `.env`:

```bash
docker compose -f docker-compose.prod.yml up -d

docker compose -f docker-compose.prod.yml --profile ops run --rm \
  -e DATABASE_URL="sqlserver://mssql:1433;database=iams;user=sa;password=${MSSQL_SA_PASSWORD};encrypt=true;trustServerCertificate=true" \
  db-migrate
```

That migration run also creates the tables `iams_app` will read/write, but
`iams_app` needs its permissions granted explicitly:

```bash
docker compose -f docker-compose.prod.yml exec mssql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -d iams -Q "
CREATE USER iams_app FOR LOGIN iams_app;
ALTER ROLE db_datareader ADD MEMBER iams_app;
ALTER ROLE db_datawriter ADD MEMBER iams_app;
GRANT EXECUTE TO iams_app;
"
```

Seed roles/permissions/templates (idempotent — safe to re-run):

```bash
docker compose -f docker-compose.prod.yml --profile ops run --rm db-seed
```

Check everything is up:

```bash
docker compose -f docker-compose.prod.yml ps
```

**Deal with the seeded test users now**, before this is reachable from
outside: log in as the seeded super admin, change its password to a strong
unique one, and deactivate every other seeded account (`admin@example.com`,
`auditor@gbb.gov.ng`, …) from Users → deactivate. Real users arrive through
Entra SSO group mappings (Settings → Directory) after that.

---

## 5. TLS certificate

`deploy/nginx.conf` is already in the repo and already points at your host
(§3). Put the certificate in place:

- **GBB internal CA:** copy `fullchain.pem` and `privkey.pem` into
  `/opt/iams/certs`, then `chmod 600 /opt/iams/certs/*`.
- **Public DNS (Let's Encrypt):**
  ```bash
  sudo apt install -y certbot
  docker compose -f docker-compose.prod.yml stop nginx
  sudo certbot certonly --standalone -d ${HOST}
  sudo mkdir -p /opt/iams/certs
  sudo ln -sf /etc/letsencrypt/live/${HOST}/fullchain.pem /opt/iams/certs/fullchain.pem
  sudo ln -sf /etc/letsencrypt/live/${HOST}/privkey.pem /opt/iams/certs/privkey.pem
  docker compose -f docker-compose.prod.yml start nginx
  (crontab -l 2>/dev/null; echo "0 3 * * 1 certbot renew --deploy-hook 'docker compose -f /opt/iams/app/docker-compose.prod.yml restart nginx'") | crontab -
  ```

Restart nginx to pick up the certs:

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

---

## 6. Background jobs — the one rule

Jobs run in-process inside `iams-api` via node-cron (persisted to
`scheduled_jobs` / `scheduled_job_runs`). **Never scale `iams-api` beyond one
replica** — every job would run N times. If the container is down, jobs
don't run; `restart: unless-stopped` plus the health check covers that.

Monitor: `GET /api/v1/jobs` (permission `job:read`). Disable any job per-row
via `scheduled_jobs.is_active`.

| Job key | Schedule | Breaks if stopped |
|---|---|---|
| `BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE` | every minute | all email + in-app notifications |
| `BG:TOKEN:CLEANUP:HOURLY` | hourly | stale refresh tokens accumulate |
| `BG:AUDIT:REMINDER:DAILY` | daily | SLA reminder emails |
| `BG:WORKFLOW:ESCALATION:HOURLY` | hourly | overdue/stalled escalations |
| `BG:AUDIT:RECONCILE:STATUS:HOURLY` | hourly | engagement auto-advance safety net |
| `BG:USER:MFA_GRACE_REMINDER:DAILY` | daily | 2FA enrolment nudges |
| `BG:INTEGRATION:DIRECTORY:SYNC:DAILY` | nightly | AD role reconcile + deprovision |
| `BG:DOCUMENT:VERSION:PRUNE:WEEKLY` | Sun 03:00 | old document versions accumulate |
| `BG:RETENTION:PURGE:WEEKLY` | Sun 04:00 | NDPR retention enforcement stops |
| `BG:LOG:ARCHIVE:WEEKLY` | weekly | warehouse push (still TODO) |

---

## 7. Backups

Two things hold state: the database and the uploads directory. They must be
restored **as a pair** — document rows reference files by `storage_path`; a
DB restored ahead of the uploads it references means broken downloads. Back
up both on the same schedule, right after each other.

```bash
sudo apt install -y restic
restic -r sftp:backup@<backup-host>:/backups/iams init   # fill in — once; store the repo password in GBB's vault

cat > /opt/iams/backup.sh <<EOF
#!/usr/bin/env bash
set -euo pipefail
export RESTIC_REPOSITORY=sftp:backup@<backup-host>:/backups/iams
export RESTIC_PASSWORD_FILE=/opt/iams/.restic-pass
cd /opt/iams/app
source .env

docker compose -f docker-compose.prod.yml exec -T mssql /opt/mssql-tools18/bin/sqlcmd \\
  -S localhost -U sa -P "\$MSSQL_SA_PASSWORD" -C -Q \\
  "BACKUP DATABASE iams TO DISK='/var/opt/mssql/iams.bak' WITH INIT, COMPRESSION"
docker compose -f docker-compose.prod.yml cp mssql:/var/opt/mssql/iams.bak \\
  /opt/iams/backups/iams-\$(date +%F).bak

restic backup /opt/iams/backups /opt/iams/uploads /opt/iams/app/.env /opt/iams/certs
restic forget --keep-daily 30 --keep-monthly 12 --prune
find /opt/iams/backups -name '*.bak' -mtime +2 -delete
EOF
chmod 700 /opt/iams/backup.sh
echo "<restic repo password from GBB's vault>" | sudo tee /opt/iams/.restic-pass >/dev/null   # fill in
sudo chmod 600 /opt/iams/.restic-pass

(crontab -l 2>/dev/null; echo "30 2 * * * /opt/iams/backup.sh >> /opt/iams/logs/backup.log 2>&1") | crontab -
```

**Restore drill — do this once before go-live, then quarterly:**

```bash
restic restore latest --target /tmp/restore-test --include /opt/iams/uploads
# compare a checksum against the live copy
docker compose -f docker-compose.prod.yml exec mssql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q \
  "RESTORE VERIFYONLY FROM DISK='/var/opt/mssql/iams.bak'"
```

A backup that has never been restored is a hope, not a backup.

---

## 8. Go-live verification

```bash
docker compose -f docker-compose.prod.yml exec iams-api wget -qO- http://localhost:3000/health
docker compose -f docker-compose.prod.yml logs iams-api | grep -E "storage verified|Escalation matrix|IAMS server started"
```

Then in a browser:

1. `https://<host>/login` loads over TLS (padlock, no mixed content).
2. Log in as the re-passworded super admin → 2FA enrolment prompt appears.
3. "Sign in with Microsoft" completes and lands on the dashboard.
4. Upload a document to any engagement, then download it.
5. Trigger a password-reset email — validates SMTP + `FRONTEND_URL`.
6. `GET /api/v1/jobs` — all jobs registered.
7. Analytics → "Committee pack (PDF)" downloads.
8. `sudo reboot` once — everything must come back on its own.

---

## 9. Security checklist (sign off before announcing the URL)

- [ ] All secrets generated fresh in §3 — nothing from the dev `.env` reused. Azure client secret rotated.
- [ ] `.env` and `.restic-pass` are `chmod 600`, owner `iams`; never baked into an image.
- [ ] SSH key-only, no root login, fail2ban active.
- [ ] UFW: only 22/443 open (80 only if certbot needs it). No container publishes any other port.
- [ ] TLS ≥ 1.2, HSTS on. Cookies httpOnly, HTTPS only.
- [ ] `NODE_ENV=production`, rate limiting not disabled.
- [ ] `MFA_MANDATORY=true`, `SSO_REQUIRE_IDP_MFA=true`.
- [ ] Seeded test users deactivated; super admin re-passworded.
- [ ] App runs as `iams_app` (db_datareader/db_datawriter/EXECUTE only), not `sa`. `sa` password known only to the deploy operator.
- [ ] Backups running (`/opt/iams/logs/backup.log` after night one) and one restore drill done.
- [ ] Audit trail intact: mutate something, confirm it appears in Audit Logs UI.

---

## 10. Day-2 operations

### Deploying an update

```bash
cd /opt/iams/app
git pull
source .env
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml --profile ops run --rm \
  -e DATABASE_URL="sqlserver://mssql:1433;database=iams;user=sa;password=${MSSQL_SA_PASSWORD};encrypt=true;trustServerCertificate=true" \
  db-migrate
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f iams-api
```

Run `db-seed` only when a release note says so (new permissions/templates) —
it's idempotent, but don't run it reflexively.

### Rollback

```bash
docker compose -f docker-compose.prod.yml down iams-api iams-web
# pin the previous image tags in docker-compose.prod.yml, then:
docker compose -f docker-compose.prod.yml up -d
```

Migrations are forward-only — never roll back the schema in place. If a bad
migration ships, restore the DB from backup (§7) or ship a corrective
forward migration.

### Watching it

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=200 iams-api
df -h /opt/iams
docker system df
```

### Troubleshooting

| Symptom | First check |
|---|---|
| API crash-loops at start | `docker compose logs iams-api` — missing env var or DB unreachable |
| "Local document storage is not writable" | volume mount vs `STORAGE_LOCAL_PATH`; ownership of `/opt/iams/uploads` |
| Uploads fail at ~50 MB | nginx `client_max_body_size` vs multer cap |
| No emails at all | `/api/v1/jobs` queue status, then `email_logs` table, then SMTP relay allow-list |
| SSO redirect error | Entra redirect URI must be exactly `https://<host>/api/auth/callback` |
| Download links say localhost | `APP_URL` wrong in `.env` |
| Everyone rate-limited together | Express `trust proxy` not set / `X-Real-IP` not forwarded |
| Jobs never run | replicas > 1, or container restarted mid-schedule — check `scheduled_job_runs` |
| `mssql` never goes healthy | `docker compose logs mssql` — usually a bad `MSSQL_SA_PASSWORD` (must meet SQL Server complexity rules) or `/opt/iams/mssql` not owned by uid 10001 |
