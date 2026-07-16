# IAMS — VPS Deployment Runbook (Docker)

Full flow from first SSH login to the system being live. Every step is a
command you run as-is — the only things you fill in yourself are marked
`# fill in`. Run it top to bottom.

You log in as the **`ams_vm`** user (the one GBB gave you) and use `sudo` for
anything that needs admin rights. You never need the root account directly.

---

## First, three things people always get confused about

**"Host"** = the address people type in the browser to reach IAMS. For you
that's the **VPS IP `197.159.79.65`** (no DNS name). Everywhere this runbook
says `<host>`, `<IP>`, or `${HOST}`, put that same IP.

**Docker** = instead of installing SQL Server, Node, nginx, etc. on the VM,
each part runs in its own sealed box (a *container*). One command starts them
all together. There are five:

| Container | What it is | Open to the network? |
|---|---|---|
| `mssql`    | the database        | ❌ internal only |
| `iams-api` | backend (Node)      | ❌ internal only |
| `iams-web` | frontend (Next.js)  | ❌ internal only |
| `redis`    | cache / sessions    | ❌ internal only |
| `nginx`    | the front door      | ✅ ports 80 / 443 |

**nginx** = the only container reachable from outside. Everything else is
sealed off on purpose (your database must never be directly reachable). nginx
does two jobs: (1) **HTTPS** — it holds the TLS certificate; (2) **routing** —
`/api/v1/...` goes to the backend, everything else goes to the frontend. You
barely touch it: its config is already written, you only put your IP in it and
drop the certificate files in place.

---

## 0. Before you start — have these ready

| Item | Why | Who provides |
|---|---|---|
| VPS IP + the `ams_vm` password | login | GBB IT |
| TLS certificate + key for the IP (GBB internal CA) — or you self-sign in §5 | HTTPS; login cookies are `secure` and won't work over plain http | GBB IT / you |
| SMTP host/port/credentials, relay allowed from the VPS IP | password reset, 2FA OTP, notifications | GBB IT |
| Entra ID (Azure AD) tenant ID, client ID, client secret; redirect URI set to `https://<IP>/api/auth/callback` | Microsoft SSO login | Azure tenant owner |
| Git access (deploy key or credentials) for this repo | pulling the code onto the VPS | you |

> **Azure AD + raw IP:** Entra sometimes refuses a bare IP as a redirect URI.
> If it does when you register `https://<IP>/api/auth/callback`, you'll need an
> internal DNS name for SSO. Either way, **local super-admin login works
> without SSO**, so you can go live first and wire SSO up after.

---

## 1. Server hardening (once)

Log in:

```bash
ssh ams_vm@197.159.79.65
```

### 1.1 Firewall — only SSH and HTTPS in

```bash
sudo apt update && sudo apt install -y ufw fail2ban
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

`fail2ban` protects the SSH login against password-guessing out of the box —
no config needed. (Since you log in with a password, keep that firewall and
fail2ban; do **not** disable password login or you'll lock yourself out.)

Optional, if you want automatic security patches:
`sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -f noninteractive unattended-upgrades`

### 1.2 Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ams_vm
```

Log out and back in (`exit`, then SSH in again) so the docker group applies,
then check it works:

```bash
docker --version && docker compose version
```

---

## 2. Get the application onto the VPS

```bash
sudo mkdir -p /opt/iams && sudo chown ams_vm:ams_vm /opt/iams
cd /opt/iams
git clone <repo-url> app        # fill in
cd app

mkdir -p /opt/iams/uploads /opt/iams/logs /opt/iams/backups /opt/iams/mssql /opt/iams/certs
sudo chown -R 1000:1000 /opt/iams/uploads /opt/iams/logs   # the api/web containers run as uid 1000
sudo chown -R 10001:0   /opt/iams/mssql                    # the mssql container runs as uid 10001
```

(Those uids are the users *inside* the containers — unrelated to `ams_vm`.
The folders just have to be writable by them.)

---

## 3. Generate secrets and write `.env`

Fill in the four GBB-provided values at the top, then run the **whole block** —
it generates the secrets and writes `/opt/iams/app/.env` in one shot.

```bash
cd /opt/iams/app

# fill in — your values
HOST=197.159.79.65
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

cat > .env <<EOF
APP_NAME=IAMS
NODE_ENV=production
PORT=3000
API_VERSION=v1
APP_URL=https://${HOST}
FRONTEND_URL=https://${HOST}

DATABASE_URL="sqlserver://mssql:1433;database=iams;user=sa;password=${MSSQL_SA_PASSWORD};encrypt=true;trustServerCertificate=true"
MSSQL_SA_PASSWORD=${MSSQL_SA_PASSWORD}

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

`MSSQL_SA_PASSWORD` is the database admin password. The app connects with it
directly — one login, kept simple. **Never reuse the development `.env`** — its
secrets are in git history; treat them as burned.

> **Harden later (optional):** for tighter security you can create a separate
> limited DB login (`db_datareader` / `db_datawriter` / `EXECUTE` only) and
> point `DATABASE_URL` at that instead of `sa`. Not needed to go live.

Point nginx at your IP:

```bash
sed -i "s/<host>/${HOST}/g" deploy/nginx.conf
```

---

## 4. Bring the stack up

Start the database first, wait until it's healthy, create the empty database,
then start everything else and load the schema.

```bash
source .env    # loads MSSQL_SA_PASSWORD into this shell

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d mssql

# wait until SQL Server reports healthy
until docker compose -f docker-compose.prod.yml ps mssql | grep -q healthy; do
  sleep 3
done

# create the empty database
docker compose -f docker-compose.prod.yml exec mssql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "CREATE DATABASE iams;"
```

Now start the rest and load the schema (`.env` already points at `sa`, so
migrate needs no extra flags):

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml --profile ops run --rm db-migrate
```

Seed roles, permissions, templates, and the **single super-admin account**
(safe to re-run — it's idempotent). Because `NODE_ENV=production`, the seed
creates **only** the super admin, not the dev/test users:

```bash
docker compose -f docker-compose.prod.yml --profile ops run --rm db-seed
```

Check everything is up:

```bash
docker compose -f docker-compose.prod.yml ps
```

**The only login that exists is the super admin:**

- email: `superadmin@gbb.gov.ng`
- password: `Bello@123456!`

Log in once (after §5 gives you HTTPS), **change that password immediately**,
and set up its 2FA. Every other user comes later — either you create them in
Users, or they arrive through Entra SSO.

---

## 5. TLS certificate

nginx needs a certificate + key at `/opt/iams/certs/fullchain.pem` and
`/opt/iams/certs/privkey.pem`. Two ways:

**Option A — GBB internal CA (preferred):** copy the `fullchain.pem` and
`privkey.pem` GBB issued for your IP into `/opt/iams/certs`, then:

```bash
sudo chmod 600 /opt/iams/certs/*
```

**Option B — self-signed (quickest; browsers show a one-time warning):**

```bash
sudo openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout /opt/iams/certs/privkey.pem -out /opt/iams/certs/fullchain.pem \
  -subj "/CN=${HOST}" -addext "subjectAltName=IP:${HOST}"
sudo chmod 600 /opt/iams/certs/*
```

(Let's Encrypt is **not** an option here — it needs a public DNS name, and you
have an internal IP.)

Restart nginx to pick up the certificate:

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

Now `https://<IP>/login` should load.

---

## 6. Background jobs — the one rule

Jobs run inside `iams-api` (node-cron, persisted to `scheduled_jobs`). **Never
run more than one `iams-api` replica** — every job would run twice. If the
container is down jobs don't run; `restart: unless-stopped` + the health check
handle that. Monitor at `GET /api/v1/jobs` (permission `job:read`); disable any
job by setting `scheduled_jobs.is_active = 0`.

| Job key | Schedule | Breaks if stopped |
|---|---|---|
| `BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE` | every minute | all email + in-app notifications |
| `BG:TOKEN:CLEANUP:HOURLY` | hourly | stale refresh tokens accumulate |
| `BG:AUDIT:REMINDER:DAILY` | daily | SLA reminder emails |
| `BG:WORKFLOW:ESCALATION:HOURLY` | hourly | overdue escalations |
| `BG:AUDIT:RECONCILE:STATUS:HOURLY` | hourly | engagement auto-advance safety net |
| `BG:USER:MFA_GRACE_REMINDER:DAILY` | daily | 2FA enrolment nudges |
| `BG:INTEGRATION:DIRECTORY:SYNC:DAILY` | nightly | AD role reconcile + deprovision |
| `BG:DOCUMENT:VERSION:PRUNE:WEEKLY` | Sun 03:00 | old document versions accumulate |
| `BG:RETENTION:PURGE:WEEKLY` | Sun 04:00 | NDPR retention enforcement stops |
| `BG:LOG:ARCHIVE:WEEKLY` | weekly | warehouse push (still TODO) |

---

## 7. Backups (simple)

Two things hold state: the **database** and the **uploads** folder. Restore
them **as a pair** — document rows reference files, so a DB restored without
its uploads means broken downloads.

This script dumps both nightly to `/opt/iams/backups` and keeps 14 days.
**Copy that folder off the box** (to GBB's file server / backup share) — a
backup that only lives on the same VM isn't really a backup.

```bash
cat > /opt/iams/backup.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/iams/app
source .env
STAMP=$(date +%F)

# database
docker compose -f docker-compose.prod.yml exec -T mssql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q \
  "BACKUP DATABASE iams TO DISK='/var/opt/mssql/iams.bak' WITH INIT, COMPRESSION"
docker compose -f docker-compose.prod.yml cp mssql:/var/opt/mssql/iams.bak \
  /opt/iams/backups/iams-$STAMP.bak

# uploads
tar czf /opt/iams/backups/uploads-$STAMP.tgz -C /opt/iams uploads

# keep 14 days
find /opt/iams/backups -mtime +14 -delete
EOF
chmod 700 /opt/iams/backup.sh

# run it every night at 02:30
(crontab -l 2>/dev/null; echo "30 2 * * * /opt/iams/backup.sh >> /opt/iams/logs/backup.log 2>&1") | crontab -
```

Test a restore once before you announce go-live, then occasionally after.

---

## 8. Go-live verification

```bash
docker compose -f docker-compose.prod.yml exec iams-api wget -qO- http://localhost:3000/health
docker compose -f docker-compose.prod.yml ps
```

Then in a browser:

1. `https://<IP>/login` loads over HTTPS.
2. Log in as `superadmin@gbb.gov.ng` → change the password → set up 2FA.
3. (If SSO is wired) "Sign in with Microsoft" completes and lands on the dashboard.
4. Upload a document to an engagement, then download it.
5. Trigger a password-reset email — proves SMTP works.
6. `GET /api/v1/jobs` — all jobs registered.
7. `sudo reboot` once — everything comes back on its own.

---

## 9. Security checklist (sign off before announcing the URL)

- [ ] All secrets generated fresh in §3 — nothing from the dev `.env` reused.
- [ ] `.env` is `chmod 600`, owner `ams_vm`.
- [ ] UFW: only 22 and 443 open. fail2ban active. No container publishes any other port.
- [ ] HTTPS works; cookies are httpOnly + secure.
- [ ] `NODE_ENV=production`, rate limiting on.
- [ ] `MFA_MANDATORY=true`.
- [ ] Super admin password changed from the seed default; 2FA set up.
- [ ] Backups running (check `/opt/iams/logs/backup.log` after night one) and one restore tested.
- [ ] Audit trail works: change something, confirm it shows in Audit Logs.

---

## 10. Day-2 operations

### Deploy an update

```bash
cd /opt/iams/app
git pull
source .env
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml --profile ops run --rm db-migrate
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f iams-api
```

Run `db-seed` again only when a release note says to (new permissions/templates).

### Watch it

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=200 iams-api
df -h /opt/iams
```

### Troubleshooting

| Symptom | First check |
|---|---|
| API keeps restarting | `docker compose logs iams-api` — missing env var or DB unreachable |
| "storage is not writable" | ownership of `/opt/iams/uploads` (should be uid 1000) |
| Uploads fail near 50 MB | nginx `client_max_body_size` vs the app's cap |
| No emails at all | `/api/v1/jobs` queue, then `email_logs` table, then SMTP relay allow-list |
| SSO redirect error | Entra redirect URI must be exactly `https://<IP>/api/auth/callback` |
| Download links show localhost | `APP_URL` wrong in `.env` |
| `mssql` never healthy | `docker compose logs mssql` — usually a weak `MSSQL_SA_PASSWORD` (must meet SQL Server complexity rules) or `/opt/iams/mssql` not owned by uid 10001 |
