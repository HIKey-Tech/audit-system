# IAMS — Security Review

**Date:** 2026-06-23
**Scope:** `audit-system/` backend (Node.js + Express + TypeScript + Prisma). 259 source files.
**Method:** Manual code review of the entry point, all shared infrastructure (config, auth/authz, validation, error handling, Prisma), the full authentication surface (login, MFA, password reset, OIDC/SSO, tokens), document/storage, messaging/email, logging, background jobs, settings, dashboard raw SQL, plus a dependency audit. Authn presence and DTO validation were spot-checked across every controller. Pure DTO/enum/mapper/interface files were skimmed, not line-read.

Severity scale: **Critical / High / Medium / Low / Info**.

---

## Summary table

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | **Critical** | Live secrets committed to git (DB, JWT, Azure AD, SMTP, AWS, MFA key) | `.env`, `.gitignore` |
| 2 | **High** | Broken object-level authorization on entity-attached documents (IDOR/BOLA) | `document.service.ts`, `document.controller.ts` |
| 3 | **High** | Vulnerable `nodemailer` (SMTP/CRLF injection, SSRF, file read) | dependency |
| 4 | **High** | Vulnerable `xlsx` (prototype pollution + ReDoS) reachable via upload | dependency / working-paper import |
| 5 | **Medium** | Privilege escalation via `role:assign` — can grant `super_admin` to self | `user.service.ts` |
| 6 | **Medium** | User / account-status enumeration on forgot-password | `password-reset.service.ts` |
| 7 | **Medium** | SSO account linking by email → potential account takeover | `user.service.ts` (`syncFromAzureAd`) |
| 8 | **Medium** | OIDC `state`/PKCE stored in process memory (CSRF + multi-instance) | `oidc.client.ts` |
| 9 | **Medium** | Deployed config defaults are insecure (`NODE_ENV=development` disables rate limiting) | `.env`, `server.ts` |
| 10 | **Low/Med** | Access-token revocation latency — `is_active`/roles not re-checked per request | `auth.middleware.ts` |
| 11 | **Low** | Inconsistent permission guards on user routes | `user.controller.ts` |
| 12 | **Low** | `changePassword` does not revoke existing sessions | `user.service.ts` |
| 13 | **Low** | JWT verification does not pin `algorithms` | `auth.middleware.ts`, `mfa.utility.ts` |
| 14 | **Low** | `MFA_ENCRYPTION_KEY` silently falls back to `JWT_SECRET` | `mfa.utility.ts`, `app.config.ts` |
| 15 | **Low** | Swagger `/docs` + `/docs.json` exposed unauthenticated | `server.ts` |
| 16 | **Low** | Uploads: no MIME/extension allowlist, no malware scanning | `document.controller.ts`, `document.service.ts` |
| 17 | **Info** | "Signatures" are hash manifests, not cryptographic signatures | `signature.utility.ts` |
| 18 | **Info** | Remaining moderate dependency advisories (`qs`/express, `joi`, `uuid`) | dependencies |

---

## Findings

### 1. (Critical) Live secrets committed to the git repository

`.gitignore` contains only `node_modules`, and `.env` **is tracked in git** (`git ls-files .env` → `.env`). The committed `.env` holds real, in-use production/staging credentials:

- **Azure SQL** connection string with password `GBB2026@DATA` for `iams_admin@iams-server.database.windows.net`
- **JWT_SECRET** and **JWT_REFRESH_SECRET** (forging these = arbitrary auth/token forgery for the whole system)
- **Azure AD client secret** (`AZURE_AD_CLIENT_SECRET`)
- **SMTP** mailbox credentials (`davidaiyewumi@hikey.com.ng` / `hikeyxwole@2026`)
- **AWS access key + secret** (`AKIA5CKAIPADRYD4KXNH` / `e/QIZ…`) for the live `iams-gbb-staging-documents` S3 bucket
- **MFA_ENCRYPTION_KEY** (decrypts TOTP secrets at rest)

Anyone with repo access (or anyone the repo is ever pushed to) has full control of the database, can forge JWTs for any user, read/write the document bucket, send mail as the org, and decrypt MFA secrets. This directly violates the project's own rule ("Never commit secrets").

**Recommendation**
- **Rotate every credential above immediately** — they must be considered compromised.
- Add `.env` (and `*.env`, `.env.*`) to `.gitignore`; `git rm --cached .env`; purge from history (`git filter-repo` / BFG) since history retains them.
- Keep only `.env.example` with placeholder values in the repo.
- Move production secrets to a secrets manager (Azure Key Vault) / environment injection; never to disk in the repo.
- Add a secret-scanning pre-commit hook / CI gate (e.g. gitleaks).

---

### 2. (High) Broken object-level authorization on entity-attached documents

`DocumentService._assertCanAccess()` only enforces isolation for *personal* documents (`entity_type === null`):

```ts
private _assertCanAccess(doc, requesterId): void {
  if (doc.entity_type === null && doc.uploaded_by_id !== requesterId) {
    throw AppError.notFound('Document');
  }
}
```

For **any** entity-attached document (audit evidence, working papers, signed reports, request attachments, signatures), access is granted to *any authenticated user holding `document:read`*, with no check that the user belongs to the engagement/audit the document is attached to. The code comment claims these are "governed by their owning module's access rules," but the document read paths do not call into those rules:

- `GET /documents/by-entity/:entityType/:entityId` → `listByEntity()` has **no ownership/membership check at all** — any `document:read` holder can enumerate and list every document for any entity by guessing/iterating `entityType`+`entityId`.
- `GET /documents/serve/:storedName`, `GET /documents/:id/file`, `GET /documents/:id/download` → all resolve through `_assertCanAccess`, which is a no-op for entity docs.

Impact: a low-privileged or "restricted" auditor (the codebase has `isRestrictedAuditor` logic elsewhere, e.g. dashboard) can read sensitive audit evidence and signed reports for engagements they are not assigned to. This is the highest-impact application-logic flaw given the audit/compliance context (confidential findings, evidence).

**Recommendation**
- Enforce engagement/entity-level authorization in the document read paths. Resolve `entity_type`+`entity_id` to its owning record and apply the same visibility rule used for that module (lead auditor / assigned team / restricted-auditor logic), rather than a blanket `document:read`.
- For `listByEntity`, require the caller to be authorized for that specific entity before returning anything.
- Path-traversal note: `serveFile` is *not* traversal-exploitable because it requires `storage_path` to match a DB row first — keep that invariant if refactoring.

---

### 3. (High) Vulnerable `nodemailer` — SMTP / CRLF injection, SSRF, file read

`npm audit` flags `nodemailer <=9.0.0` (current install) with multiple advisories incl. SMTP command injection, CRLF header injection in `List-*`/transport name, and `raw`/jsonTransport bypasses enabling arbitrary file read and SSRF. The mailer is used for password-reset, MFA OTP, and onboarding mails (`notification.service.ts`).

**Recommendation**
- Upgrade to `nodemailer@>=9.0.1` (`npm audit fix --force` flags it as breaking — test the send path).
- Continue to derive `to`/`subject` from validated internal data only; never pass untrusted input into transport/header fields.

---

### 4. (High) Vulnerable `xlsx` (SheetJS) reachable via file upload

`xlsx@0.18.5` (npm) has **no fixed version on the npm registry** and is flagged for Prototype Pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9). It parses **user-uploaded** spreadsheets in `working-paper-import.utility.ts` (alongside `mammoth` for .docx and `pdf-parse` for .pdf, which also parse untrusted bytes). A crafted `.xlsx` can trigger prototype pollution / DoS.

**Recommendation**
- Migrate to the SheetJS-maintained build from their official source (the fixed releases are distributed outside npm), or replace with a maintained parser (e.g. `exceljs`).
- Enforce upload size/type limits before parsing (a 50MB limit exists; add per-parser guards), and run parsing in a worker/timeout to contain ReDoS.
- Consider sandboxing document parsing.

---

### 5. (Medium) Privilege escalation through `role:assign`

`UserController` gates `PUT /users/:id/roles` with `requirePermission('role:assign')`. `UserService.assignRoles()` then upserts any role IDs and calls `_syncUserSuperAdminFlag()`, which sets `is_super_admin = true` whenever the user holds the `super_admin` role. There is:
- no check that the actor may grant the *specific* role (a holder of `role:assign` can grant `super_admin` to themselves or anyone), and
- no special protection of the `super_admin` role or the actor's own account.

So `role:assign` is effectively equivalent to full super-admin. `createUser` (`user:create`) has the same property — it can mint a `super_admin`.

**Recommendation**
- Restrict assignment of privileged roles (especially `super_admin`) to super-admins only.
- Prevent self-elevation: an actor should not be able to grant themselves a role that exceeds their current privileges ("no privilege escalation" / least-privilege delegation).
- Audit-log role grants with before/after (already partially logged) and alert on `super_admin` grants.

---

### 6. (Medium) User / account-status enumeration on password reset

The controller returns a generic "a reset link has been sent" message, but `PasswordResetService.requestReset()` *throws* distinguishable errors that propagate to the client:
- non-existent email → `404 notFound('Account')`
- inactive account → `403 forbidden('This account is inactive…')`
- SSO-only account → `400 badRequest('…uses single sign-on…')`

An attacker can enumerate which emails are registered, which are active, and which are local vs SSO. `login` is mostly safe (uniform "Invalid credentials") but also returns early without a bcrypt compare when the user is missing, leaving a timing side-channel.

**Recommendation**
- Always return the same generic 200 response from `requestReset` regardless of whether the account exists / is active / is SSO. Log the real reason server-side only.
- Optionally normalize login timing (perform a dummy bcrypt compare on the no-user path).

---

### 7. (Medium) SSO account linking by email enables takeover

`syncFromAzureAd()` matches an existing user by `OR: [{ azure_oid }, { email: profile.email }]`. The email is taken from `preferred_username || email || upn`. If an IdP can present a token whose email equals an existing IAMS user's email, the SSO login links to and assumes that account. With the **generic OIDC** client the email claim may be unverified/attacker-influenced; for multi-tenant scenarios this is account takeover. Single-tenant Entra reduces but does not eliminate the risk.

**Recommendation**
- Link strictly on the immutable `oid`/`sub`. Only fall back to email matching when the IdP asserts the email is verified (`email_verified` claim) **and** the provider is trusted/single-tenant.
- For first-time links to a pre-existing local account, require an explicit, verified linking step rather than silent merge.

---

### 8. (Medium) OIDC `state`/PKCE verifier stored in process memory

`oidc.client.ts` keeps `stateVerifierMap` / `stateNonceMap` as in-process `Map`s with a `setTimeout` eviction. Consequences:
- In a clustered/multi-instance deployment (the stated target), the callback can land on a different instance than the one that issued `state`, so the verifier is missing → SSO breaks, and the CSRF/state protection effectively depends on sticky sessions.
- A process restart drops all in-flight logins.
- `setTimeout`-based cleanup is best-effort; abandoned flows linger.

Redis is already a dependency and configured.

**Recommendation**
- Persist `state → {verifier, nonce}` in Redis (or a signed, httpOnly cookie) with a short TTL, consumed once. This makes CSRF protection robust and multi-instance-safe.

---

### 9. (Medium) Insecure deployed configuration defaults

The committed `.env` sets `NODE_ENV=development`. In `server.ts`, both the general and the credential/OTP rate limiters `skip: () => config.app.isDev`. If this `.env` ships as-is, **all brute-force protection is disabled**, Prisma query logging is on, and other dev paths activate. The auth brute-force defense is one of the few that genuinely needs to be on in prod.

**Recommendation**
- Ensure `NODE_ENV=production` in real deployments; fail fast / warn if rate limiting is disabled while not on localhost.
- Re-validate that `RATE_LIMIT_*`, `CACHE_DRIVER=redis`, and `MFA_*` are production-appropriate. (Note: committed `.env` sets `JWT_EXPIRES_IN=60m`, longer than the 15m default — see #10.)

---

### 10. (Low/Medium) Access-token revocation latency

`authenticate` trusts the JWT's embedded `roles`/`permissions`/`isSuperAdmin` and does **not** re-check the DB on each request. Refresh and login check `is_active`, but a standalone access token (committed `.env`: 60-minute lifetime) remains fully valid after a user is deactivated, deleted, or has roles/permissions revoked, until it expires. Logout does not invalidate the access token (stateless design). For a compliance-sensitive system, de-provisioning should be prompt.

**Recommendation**
- Shorten access-token TTL (15m as the config default intends) to bound exposure.
- For high-impact actions or as a global control, check user `is_active` (and optionally a token-version / `tokens_valid_after` timestamp bumped on role change/logout-all) against the DB or a Redis denylist.

---

### 11. (Low) Inconsistent permission guards on user routes

In `user.controller.ts` the guards don't match intent/JSDoc:
- `GET /users` (list users) → `requirePermission('role:read')`
- `GET /users/roles` → `requirePermission('permission:read')`
- `GET /users/permissions` → `requirePermission('user:read')`

These cross-wired permissions can grant or deny access in surprising ways (e.g. someone with `role:read` but not `user:read` can list all users).

**Recommendation**
- Align each route with the resource it exposes (`user:read` for users, `role:read` for roles, `permission:read` for permissions) and add a test asserting the mapping.

---

### 12. (Low) `changePassword` does not revoke existing sessions

`PasswordResetService.resetPassword` correctly revokes all refresh tokens, but `UserService.changePassword` (voluntary change) updates the hash only. After a user changes their password (e.g. suspecting compromise), previously issued refresh/access tokens remain valid.

**Recommendation**
- Revoke the user's refresh tokens on password change (optionally keep the current session). Pair with #10's token-version idea for access tokens.

---

### 13. (Low) JWT verification does not pin algorithms

`jwt.verify(token, config.jwt.secret)` is called without `{ algorithms: ['HS256'] }` in `auth.middleware.ts` and `mfa.utility.ts`. With a symmetric secret, jsonwebtoken v9 already rejects `alg:none` and there is no RS256 public key in play, so this isn't currently exploitable — but pinning is cheap defense-in-depth against future key/config changes.

**Recommendation**
- Pass `algorithms: ['HS256']` to all `jwt.verify` calls. Consider adding `issuer`/`audience` claims.

---

### 14. (Low) `MFA_ENCRYPTION_KEY` silently falls back to `JWT_SECRET`

`mfa.utility.ts` derives the AES-256-GCM key from `config.mfa.encryptionKey || config.jwt.secret`. If the env var is unset in production, TOTP secrets are encrypted with a key derived from the JWT secret with no warning — coupling two security domains and weakening the at-rest protection's intent.

**Recommendation**
- Require `MFA_ENCRYPTION_KEY` in production (`requireEnv` when `isProd`); fail fast if missing rather than silently falling back.

---

### 15. (Low) Swagger UI exposed without authentication

`server.ts` serves `/docs` and `/docs.json` with no auth, before the API routers. In production this publishes the full API surface (every route, schema, and `persistAuthorization`) to anonymous users, aiding reconnaissance.

**Recommendation**
- Gate `/docs` behind authentication, or disable it when `isProd`, or restrict to an internal network.

---

### 16. (Low) Uploads: no content-type allowlist or malware scanning

`document.controller.ts` accepts any file up to 50MB (`multer.memoryStorage`) with no MIME/extension allowlist and no AV scan. Files are stored under random UUID names and served with `Content-Disposition: attachment` and the stored MIME, which mitigates stored-XSS for most cases — but HTML/SVG content and malware-bearing documents can still be stored and redistributed to other users.

**Recommendation**
- Enforce an allowlist of expected document types; validate magic bytes, not just the client-supplied MIME.
- Add malware scanning (e.g. ClamAV) for an audit system that ingests third-party evidence.
- Set `X-Content-Type-Options: nosniff` (helmet default covers this) and keep `attachment` disposition.

---

### 17. (Info) "Signatures" are content hashes, not cryptographic signatures

`signature.utility.ts` builds a canonical JSON manifest and stores a SHA-256 digest for tamper-evidence. This detects later modification but provides no cryptographic non-repudiation (no per-signer key/PKI). For ISO 27001 / regulatory sign-off this may be insufficient depending on GBB's evidentiary requirements.

**Recommendation**
- Confirm the compliance requirement. If non-repudiation is needed, move to digital signatures (per-user keys / HSM / qualified e-signatures) over the manifest.

---

### 18. (Info) Remaining moderate dependency advisories

`npm audit` also reports moderate issues: `qs` (via `express`/`body-parser`), `joi` (recursive `link()` RangeError DoS), and `uuid` (transitive via `@azure/msal-node`, `bull`, `node-cron`, `passport-azure-ad`).

**Recommendation**
- Run `npm audit fix` for the non-breaking ones; plan upgrades for the transitive `uuid`/`msal` chain. Add `npm audit` (or Dependabot/Snyk) to CI.

---

## What was checked and looked solid

- **Password storage:** bcrypt cost 12; temp passwords via `crypto.randomInt`. ✔
- **Refresh tokens:** random 64-byte, stored as SHA-256 hash, rotation with reuse/theft detection and a bounded grace window; atomic single-use via conditional `updateMany`. ✔
- **Password reset / email OTP:** tokens hashed at rest, single-use, expiry + attempt caps; sessions revoked on reset. ✔
- **TOTP secrets:** AES-256-GCM at rest; backup codes bcrypt-hashed and single-use. ✔
- **SQL injection:** all raw queries use `Prisma.sql` tagged templates with parameterized interpolation (dashboard). No string-concatenated SQL or `*RawUnsafe`. ✔
- **Input validation:** Zod schemas on body/query/params; `z.object` strips unknown keys, so mass-assignment on `/users/me` is contained (`UpdateUserRequestSchema` excludes roles/flags). ✔
- **Pagination:** `parsePagination` hard-caps `pageSize` at 100 (DoS guard) even where Zod doesn't. ✔
- **Error handling:** no stack traces or Prisma internals leaked to clients; generic 400/500 envelopes. ✔
- **Auth coverage:** every controller mounts `authenticate`; mutating audit logging is automatic and never crashes the request. ✔
- **Template rendering:** email templating is a safe `{{key}}` regex replace; DOCX uses docxtemplater default delimiters (no angular/eval parser) with admin-supplied templates. ✔
- **Security headers / hardening:** `helmet()`, `x-powered-by` disabled, CORS pinned to a single origin with credentials, `trust proxy` set. ✔

---

## Suggested remediation order

1. **Now:** Rotate all leaked credentials and remove `.env` from git/history (#1).
2. **This sprint:** Fix document object-level authorization (#2); upgrade `nodemailer` and replace/upgrade `xlsx` (#3, #4); restrict privileged role assignment (#5).
3. **Next:** Generic password-reset responses (#6); harden SSO linking + move OIDC state to Redis (#7, #8); enforce `NODE_ENV=production` posture (#9).
4. **Hardening backlog:** token revocation/TTL (#10, #12), permission-guard cleanup (#11), pin JWT alg (#13), require MFA key (#14), gate Swagger (#15), upload allowlist + AV (#16), signature model (#17), remaining `npm audit` items (#18).
