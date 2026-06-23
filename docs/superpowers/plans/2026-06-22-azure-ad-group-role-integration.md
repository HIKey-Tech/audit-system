# Azure AD Group → Role Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user's Azure AD (Entra ID) security-group membership automatically grant IAMS roles, without changing IAMS's permission-based model or breaking local login.

**Architecture:** Azure stays the authority for *identity + group membership*; IAMS stays the authority for *roles → permissions*. A new admin-managed mapping table (`directory_group_mappings`) translates an Azure group Object ID into an IAMS role. A pure reconciler applies those roles on SSO login and on a nightly Microsoft Graph sync, touching only `azure_ad`-sourced role rows so manual assignments and local accounts are never disturbed.

**Tech Stack:** Node + Express + TypeScript (strict), Prisma (SQL Server), `@azure/msal-node` (already a dependency), Microsoft Graph REST via global `fetch` (Node 20), Zod, Jest (one targeted unit test only).

## Global Constraints

- **House verification = `npm run build` (tsc) + manual API smoke check.** This repo has zero Jest tests by design (CLAUDE.md §8). Only Task 2 (the pure reconciler) adds a unit test, because it is pure logic with high branch density. Every other task is gated by `npm run build` passing.
- **All external integrations are read-only** (CLAUDE.md hard rule #3). The Graph client only ever *reads* from Azure. IAMS never writes to Entra.
- **Module conventions are non-negotiable** — copy the layout/conventions of the `user`/`settings` modules exactly (CLAUDE.md §4–5): class controllers with `_registerRoutes()`, `IXxxService` interface + class impl, Zod request DTOs, response mappers, `AppError` factories, `auditLogService.logAsync(...)` on every mutation, `buildResponse(...)` for every HTTP response.
- **Permission slug for all mapping admin routes:** reuse existing `settings:manage` (write) and `settings:read` (read). Do **not** invent a new permission.
- **Role-source values:** the string literals are exactly `'manual'` and `'azure_ad'`. Never any other casing/spelling.
- **No cross-module Prisma reaching except where noted:** the integration service owns the `user_roles` reconcile write (justified in Task 4) to avoid a `user ↔ integration` cycle; the `user` module calls *into* the integration service, never the reverse.
- **SQL Server has no enums / no Prisma `Json`** — model enum-like fields as `String`, JSON as `NVarChar(Max)` strings (existing convention).

---

## File Structure

**New module — `src/modules/integration/`** (the previously-gated module; its deps user/settings/background all exist, so building it now is in build-order):

| File | Responsibility |
|---|---|
| `index.ts` | `createIntegrationModule(): Router` factory + re-exports |
| `controller/directory-mapping.controller.ts` | Class controller, CRUD routes for group→role mappings + manual "sync now" trigger |
| `service/interface/directory.service.interface.ts` | `IDirectoryMappingService`, `IGraphDirectoryClient`, shared types |
| `service/implementation/directory-mapping.service.ts` | Mapping CRUD, `resolveRolesForGroups`, `applyAdRolesToUser`, `runFullDirectorySync` |
| `service/client/graph.client.ts` | `IGraphDirectoryClient` + real `GraphDirectoryClient` + `StubGraphDirectoryClient` + `createGraphDirectoryClient()` factory |
| `utility/role-reconciler.utility.ts` | **Pure** `reconcileAdRoles()` — the unit-tested core |
| `dto/request/directory.request.dto.ts` | Zod schemas + inferred types |
| `dto/response/directory.response.dto.ts` | Response interfaces + `mapMappingToResponse()` |
| `domain/entity/directory.entity.ts` | Domain types |
| `__tests__/role-reconciler.test.ts` | Jest unit test for the reconciler |

**Modified files:**

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `source` to `User_Role`; add `Directory_Group_Mapping` model; add back-relation on `Role` |
| `prisma/migrations/<ts>_add_directory_group_mapping/migration.sql` | New migration |
| `src/shared/config/app.config.ts` | Add `directorySync` config + `groups` scope |
| `.env` / `.env.example` | New Graph/sync env vars |
| `src/modules/user/service/interface/user.service.interface.ts` | Add `groups?` + `groupsOverage?` to `AzureAdProfile` |
| `src/modules/user/service/client/oidc.client.ts` | Extract `groups` claim + overage flag |
| `src/modules/user/service/implementation/user.service.ts` | `syncFromAzureAd` applies AD roles via integration service |
| `src/modules/background/service/implementation/scheduler.service.ts` | Add `BG:INTEGRATION:DIRECTORY:SYNC:DAILY` job |
| `src/server.ts` | Mount `createIntegrationModule()` |
| `docs/PROJECT_STATE.md`, `CLAUDE.md` | New rev row; resolve "final identity system" open question |

---

## Task 1: Schema — role source + mapping table

**Files:**
- Modify: `prisma/schema.prisma` (Role model ~109-121, User_Role model ~137-150)
- Create: `prisma/migrations/<timestamp>_add_directory_group_mapping/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma models `Directory_Group_Mapping` (table `directory_group_mappings`) and `User_Role.source: String` (default `"manual"`), consumed by every later task.

- [ ] **Step 1: Add `source` to `User_Role`**

In `prisma/schema.prisma`, inside `model User_Role`, add the column after `expires_at`:

```prisma
model User_Role {
  id          String    @id @default(uuid())
  user_id     String
  role_id     String
  assigned_by String?
  assigned_at DateTime  @default(now())
  expires_at  DateTime?
  source      String    @default("manual") // "manual" | "azure_ad"

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  role Role @relation(fields: [role_id], references: [id], onDelete: Cascade)

  @@unique([user_id, role_id])
  @@map("user_roles")
}
```

- [ ] **Step 2: Add the mapping model + Role back-relation**

Add the back-relation line inside `model Role` (alongside `user_roles` / `role_permissions`):

```prisma
  directory_group_mappings Directory_Group_Mapping[]
```

Add the new model after `Role_Permission`:

```prisma
model Directory_Group_Mapping {
  id            String   @id @default(uuid())
  ad_group_id   String   // Azure AD security-group Object ID (GUID)
  ad_group_name String   // cached for display only
  role_id       String
  is_active     Boolean  @default(true)
  created_by    String?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  role Role @relation(fields: [role_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([ad_group_id, role_id])
  @@index([ad_group_id])
  @@index([is_active])
  @@map("directory_group_mappings")
}
```

(`NoAction` FK matches the repo's SQL-Server "no multiple cascade paths" convention.)

- [ ] **Step 3: Generate the migration + client**

Run: `npm run prisma:migrate -- --name add_directory_group_mapping`
Expected: a new folder under `prisma/migrations/`, client regenerated, no drift errors. (If the dev DB is unreachable, run `npx prisma migrate dev --create-only --name add_directory_group_mapping` then `npm run prisma:generate`.)

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS (tsc exits 0). Existing `user_roles` writes still compile because `source` has a default.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(integration): add user_role source + directory_group_mappings schema"
```

---

## Task 2: Pure role reconciler (unit-tested core)

**Files:**
- Create: `src/modules/integration/utility/role-reconciler.utility.ts`
- Test: `src/modules/integration/__tests__/role-reconciler.test.ts`

**Interfaces:**
- Produces:
  - `interface CurrentUserRole { roleId: string; source: string }`
  - `interface AdRoleReconcileResult { toAdd: string[]; toRemove: string[] }`
  - `reconcileAdRoles(currentRoles: CurrentUserRole[], desiredRoleIds: string[]): AdRoleReconcileResult`
  - Used by `DirectoryMappingService.applyAdRolesToUser` (Task 4).

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/integration/__tests__/role-reconciler.test.ts
import { reconcileAdRoles } from '../utility/role-reconciler.utility';

describe('reconcileAdRoles', () => {
  it('adds a desired role the user does not have yet', () => {
    const r = reconcileAdRoles([], ['auditor']);
    expect(r.toAdd).toEqual(['auditor']);
    expect(r.toRemove).toEqual([]);
  });

  it('removes an azure_ad role no longer desired', () => {
    const r = reconcileAdRoles(
      [{ roleId: 'auditor', source: 'azure_ad' }],
      [],
    );
    expect(r.toAdd).toEqual([]);
    expect(r.toRemove).toEqual(['auditor']);
  });

  it('never touches a manual role even when undesired', () => {
    const r = reconcileAdRoles(
      [{ roleId: 'audit_lead', source: 'manual' }],
      [],
    );
    expect(r.toAdd).toEqual([]);
    expect(r.toRemove).toEqual([]);
  });

  it('does not re-add a desired role that already exists as manual', () => {
    const r = reconcileAdRoles(
      [{ roleId: 'auditor', source: 'manual' }],
      ['auditor'],
    );
    expect(r.toAdd).toEqual([]);
    expect(r.toRemove).toEqual([]);
  });

  it('handles mixed add/remove/keep in one pass', () => {
    const r = reconcileAdRoles(
      [
        { roleId: 'auditor', source: 'azure_ad' }, // keep
        { roleId: 'viewer', source: 'azure_ad' },  // remove
        { roleId: 'cae', source: 'manual' },       // untouched
      ],
      ['auditor', 'audit_lead'], // audit_lead is new
    );
    expect(r.toAdd.sort()).toEqual(['audit_lead']);
    expect(r.toRemove).toEqual(['viewer']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/integration/__tests__/role-reconciler.test.ts`
Expected: FAIL — "Cannot find module '../utility/role-reconciler.utility'".

- [ ] **Step 3: Implement the reconciler**

```ts
// src/modules/integration/utility/role-reconciler.utility.ts

export interface CurrentUserRole {
  roleId: string;
  source: string; // "manual" | "azure_ad"
}

export interface AdRoleReconcileResult {
  /** role ids to insert as source="azure_ad" */
  toAdd: string[];
  /** role ids (source="azure_ad") to delete */
  toRemove: string[];
}

/**
 * Pure reconciliation of a user's Azure-derived roles.
 * - Adds desired roles the user holds under no source at all.
 * - Removes azure_ad roles the user no longer qualifies for.
 * - Manual roles are immutable here (never added, never removed).
 */
export function reconcileAdRoles(
  currentRoles: CurrentUserRole[],
  desiredRoleIds: string[],
): AdRoleReconcileResult {
  const desired = new Set(desiredRoleIds);
  const heldRoleIds = new Set(currentRoles.map((r) => r.roleId));

  const toAdd = [...desired].filter((roleId) => !heldRoleIds.has(roleId));

  const toRemove = currentRoles
    .filter((r) => r.source === 'azure_ad' && !desired.has(r.roleId))
    .map((r) => r.roleId);

  return { toAdd, toRemove };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/modules/integration/__tests__/role-reconciler.test.ts`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add src/modules/integration/utility/role-reconciler.utility.ts src/modules/integration/__tests__/role-reconciler.test.ts
git commit -m "feat(integration): pure azure-ad role reconciler with unit tests"
```

---

## Task 3: Microsoft Graph directory client

**Files:**
- Create: `src/modules/integration/service/client/graph.client.ts`
- Modify: `src/shared/config/app.config.ts` (oidc block ~87-106), `.env.example`, `.env`

**Interfaces:**
- Consumes: `config.directorySync` (added here).
- Produces:
  - `interface DirectoryUser { oid: string; email: string; displayName?: string; accountEnabled: boolean; groupIds: string[] }`
  - `interface IGraphDirectoryClient { getUserGroupIds(oid: string): Promise<string[]>; listUsersWithGroups(): Promise<DirectoryUser[]> }`
  - `createGraphDirectoryClient(): IGraphDirectoryClient`
  - Consumed by Task 4 (`DirectoryMappingService`) and Task 6 (overage fallback).

- [ ] **Step 1: Add config**

In `src/shared/config/app.config.ts`, add a `directorySync` block after the `oidc` block (reuses the existing Azure app registration credentials):

```ts
  directorySync: {
    // Reuses the Azure AD app registration; needs Graph application
    // permissions User.Read.All + GroupMember.Read.All (admin-consented).
    enabled: optionalEnv('DIRECTORY_SYNC_ENABLED', 'false') === 'true',
    tenantId: optionalEnv('AZURE_AD_TENANT_ID'),
    clientId: optionalEnv('AZURE_AD_CLIENT_ID'),
    clientSecret: optionalEnv('AZURE_AD_CLIENT_SECRET'),
    graphBaseUrl: optionalEnv('GRAPH_BASE_URL', 'https://graph.microsoft.com/v1.0'),
  },
```

Also add the `groups` claim request to the Azure login scopes — in `oidc.client.ts` the scopes array is edited in Task 6; no scope is needed for token group claims (those come from the app manifest `groupMembershipClaims`), so config needs nothing more here.

- [ ] **Step 2: Add env vars**

Append to `.env.example` (and mirror real values in local `.env`):

```
# Directory sync (Azure AD → IAMS roles)
DIRECTORY_SYNC_ENABLED=false
GRAPH_BASE_URL=https://graph.microsoft.com/v1.0
```

- [ ] **Step 3: Implement the Graph client**

```ts
// src/modules/integration/service/client/graph.client.ts
import { ConfidentialClientApplication } from '@azure/msal-node';
import { config } from '../../../../shared/config/app.config';
import { logger } from '../../../../shared/utils/logger.util';

export interface DirectoryUser {
  oid: string;
  email: string;
  displayName?: string;
  accountEnabled: boolean;
  groupIds: string[];
}

export interface IGraphDirectoryClient {
  /** Overage fallback: fetch a single user's security-group ids. */
  getUserGroupIds(oid: string): Promise<string[]>;
  /** Nightly sync: all users with their group memberships + enabled flag. */
  listUsersWithGroups(): Promise<DirectoryUser[]>;
}

// ── Real client ────────────────────────────────────────────────
class GraphDirectoryClient implements IGraphDirectoryClient {
  private readonly msal: ConfidentialClientApplication;

  constructor() {
    this.msal = new ConfidentialClientApplication({
      auth: {
        clientId: config.directorySync.clientId,
        clientSecret: config.directorySync.clientSecret,
        authority: `https://login.microsoftonline.com/${config.directorySync.tenantId}`,
      },
    });
  }

  private async token(): Promise<string> {
    const res = await this.msal.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });
    if (!res?.accessToken) throw new Error('Graph token acquisition returned no token');
    return res.accessToken;
  }

  private async get<T>(path: string): Promise<T> {
    const token = await this.token();
    const res = await fetch(`${config.directorySync.graphBaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Graph GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async getUserGroupIds(oid: string): Promise<string[]> {
    const data = await this.get<{ value: { id: string }[] }>(
      `/users/${oid}/transitiveMemberOf/microsoft.graph.group?$select=id&$top=999`,
    );
    return data.value.map((g) => g.id);
  }

  async listUsersWithGroups(): Promise<DirectoryUser[]> {
    const users = await this.get<{
      value: { id: string; mail?: string; userPrincipalName?: string; displayName?: string; accountEnabled: boolean }[];
    }>(`/users?$select=id,mail,userPrincipalName,displayName,accountEnabled&$top=999`);

    const out: DirectoryUser[] = [];
    for (const u of users.value) {
      const groupIds = await this.getUserGroupIds(u.id);
      out.push({
        oid: u.id,
        email: (u.mail ?? u.userPrincipalName ?? '').toLowerCase(),
        displayName: u.displayName,
        accountEnabled: u.accountEnabled,
        groupIds,
      });
    }
    return out;
  }
}

// ── Stub (dev / sync disabled) ─────────────────────────────────
class StubGraphDirectoryClient implements IGraphDirectoryClient {
  async getUserGroupIds(): Promise<string[]> {
    logger.warn('StubGraphDirectoryClient.getUserGroupIds() — directory sync disabled');
    return [];
  }
  async listUsersWithGroups(): Promise<DirectoryUser[]> {
    logger.warn('StubGraphDirectoryClient.listUsersWithGroups() — directory sync disabled');
    return [];
  }
}

export const createGraphDirectoryClient = (): IGraphDirectoryClient =>
  config.directorySync.enabled
    ? new GraphDirectoryClient()
    : new StubGraphDirectoryClient();
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/integration/service/client/graph.client.ts src/shared/config/app.config.ts .env.example
git commit -m "feat(integration): microsoft graph directory client (real + stub + factory)"
```

---

## Task 4: Directory mapping service (CRUD + apply roles)

**Files:**
- Create: `src/modules/integration/service/interface/directory.service.interface.ts`
- Create: `src/modules/integration/service/implementation/directory-mapping.service.ts`

**Interfaces:**
- Consumes: `reconcileAdRoles` (Task 2), `IGraphDirectoryClient`/`createGraphDirectoryClient` + `DirectoryUser` (Task 3), Prisma `directory_group_mappings` + `user_roles` (Task 1).
- Produces (singleton `directoryMappingService`):
  - `createMapping(dto, actorId): Promise<DirectoryGroupMapping>`
  - `updateMapping(id, dto, actorId): Promise<DirectoryGroupMapping>`
  - `deleteMapping(id, actorId): Promise<void>`
  - `listMappings(): Promise<DirectoryGroupMapping[]>`
  - `resolveRolesForGroups(groupIds: string[]): Promise<string[]>` (returns role ids)
  - `applyAdRolesToUser(userId: string, groupIds: string[]): Promise<void>`
  - `runFullDirectorySync(): Promise<{ usersProcessed: number; deactivated: number }>`
  - Consumed by Task 5 (controller), Task 6 (login), Task 7 (job).

> **Design note (cross-module write):** this service writes `user_roles` directly. That keeps `user → integration` one-directional (the user module calls in; integration never imports user), avoiding a dependency cycle. This is the same pragmatic exception the audit module uses with dynamic workflow imports. The write is scoped strictly to `source='azure_ad'` rows.

- [ ] **Step 1: Write the interface + types**

```ts
// src/modules/integration/service/interface/directory.service.interface.ts
export interface DirectoryGroupMapping {
  id: string;
  adGroupId: string;
  adGroupName: string;
  roleId: string;
  roleName?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateMappingInput {
  adGroupId: string;
  adGroupName: string;
  roleId: string;
}

export interface UpdateMappingInput {
  adGroupName?: string;
  roleId?: string;
  isActive?: boolean;
}

export interface IDirectoryMappingService {
  createMapping(dto: CreateMappingInput, actorId: string): Promise<DirectoryGroupMapping>;
  updateMapping(id: string, dto: UpdateMappingInput, actorId: string): Promise<DirectoryGroupMapping>;
  deleteMapping(id: string, actorId: string): Promise<void>;
  listMappings(): Promise<DirectoryGroupMapping[]>;
  resolveRolesForGroups(groupIds: string[]): Promise<string[]>;
  applyAdRolesToUser(userId: string, groupIds: string[]): Promise<void>;
  runFullDirectorySync(): Promise<{ usersProcessed: number; deactivated: number }>;
}
```

- [ ] **Step 2: Implement the service**

```ts
// src/modules/integration/service/implementation/directory-mapping.service.ts
import { prisma } from '../../../../shared/prisma/prisma.client';
import { logger } from '../../../../shared/utils/logger.util';
import { AppError } from '../../../../shared/errors/app.error';
import { auditLogService } from '../../../logging/service/implementation/audit-log.service';
import { reconcileAdRoles, CurrentUserRole } from '../../utility/role-reconciler.utility';
import {
  createGraphDirectoryClient,
  IGraphDirectoryClient,
} from '../client/graph.client';
import {
  IDirectoryMappingService,
  DirectoryGroupMapping,
  CreateMappingInput,
  UpdateMappingInput,
} from '../interface/directory.service.interface';

const toMapping = (m: {
  id: string; ad_group_id: string; ad_group_name: string; role_id: string;
  is_active: boolean; created_at: Date; role?: { name: string } | null;
}): DirectoryGroupMapping => ({
  id: m.id,
  adGroupId: m.ad_group_id,
  adGroupName: m.ad_group_name,
  roleId: m.role_id,
  roleName: m.role?.name,
  isActive: m.is_active,
  createdAt: m.created_at,
});

export class DirectoryMappingService implements IDirectoryMappingService {
  constructor(private readonly graph: IGraphDirectoryClient = createGraphDirectoryClient()) {}

  async createMapping(dto: CreateMappingInput, actorId: string): Promise<DirectoryGroupMapping> {
    const role = await prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw AppError.badRequest('roleId does not reference a known role');

    const existing = await prisma.directory_Group_Mapping.findFirst({
      where: { ad_group_id: dto.adGroupId, role_id: dto.roleId },
    });
    if (existing) throw AppError.conflict('This group is already mapped to this role');

    const created = await prisma.directory_Group_Mapping.create({
      data: {
        ad_group_id: dto.adGroupId,
        ad_group_name: dto.adGroupName,
        role_id: dto.roleId,
        created_by: actorId,
      },
      include: { role: true },
    });
    auditLogService.logAsync({
      userId: actorId, module: 'integration', action: 'directory_mapping.create',
      entityType: 'directory_group_mapping', entityId: created.id, status: 'success',
    });
    logger.info('Directory group mapping created', { actorId, id: created.id });
    return toMapping(created);
  }

  async updateMapping(id: string, dto: UpdateMappingInput, actorId: string): Promise<DirectoryGroupMapping> {
    await this._assertExists(id);
    if (dto.roleId) {
      const role = await prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) throw AppError.badRequest('roleId does not reference a known role');
    }
    const updated = await prisma.directory_Group_Mapping.update({
      where: { id },
      data: {
        ad_group_name: dto.adGroupName,
        role_id: dto.roleId,
        is_active: dto.isActive,
      },
      include: { role: true },
    });
    auditLogService.logAsync({
      userId: actorId, module: 'integration', action: 'directory_mapping.update',
      entityType: 'directory_group_mapping', entityId: id, status: 'success',
    });
    return toMapping(updated);
  }

  async deleteMapping(id: string, actorId: string): Promise<void> {
    await this._assertExists(id);
    await prisma.directory_Group_Mapping.delete({ where: { id } });
    auditLogService.logAsync({
      userId: actorId, module: 'integration', action: 'directory_mapping.delete',
      entityType: 'directory_group_mapping', entityId: id, status: 'success',
    });
  }

  async listMappings(): Promise<DirectoryGroupMapping[]> {
    const rows = await prisma.directory_Group_Mapping.findMany({
      include: { role: true },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toMapping);
  }

  async resolveRolesForGroups(groupIds: string[]): Promise<string[]> {
    if (groupIds.length === 0) return [];
    const mappings = await prisma.directory_Group_Mapping.findMany({
      where: { is_active: true, ad_group_id: { in: groupIds } },
      select: { role_id: true },
    });
    return [...new Set(mappings.map((m) => m.role_id))];
  }

  async applyAdRolesToUser(userId: string, groupIds: string[]): Promise<void> {
    const desiredRoleIds = await this.resolveRolesForGroups(groupIds);
    const current: CurrentUserRole[] = (
      await prisma.user_Role.findMany({
        where: { user_id: userId },
        select: { role_id: true, source: true },
      })
    ).map((r) => ({ roleId: r.role_id, source: r.source }));

    const { toAdd, toRemove } = reconcileAdRoles(current, desiredRoleIds);
    if (toAdd.length === 0 && toRemove.length === 0) return;

    await prisma.$transaction([
      ...(toRemove.length
        ? [prisma.user_Role.deleteMany({
            where: { user_id: userId, source: 'azure_ad', role_id: { in: toRemove } },
          })]
        : []),
      ...toAdd.map((roleId) =>
        prisma.user_Role.create({ data: { user_id: userId, role_id: roleId, source: 'azure_ad' } }),
      ),
    ]);
    logger.info('Applied Azure AD roles to user', { userId, added: toAdd.length, removed: toRemove.length });
  }

  async runFullDirectorySync(): Promise<{ usersProcessed: number; deactivated: number }> {
    const directoryUsers = await this.graph.listUsersWithGroups();
    let usersProcessed = 0;
    let deactivated = 0;

    for (const du of directoryUsers) {
      const user = await prisma.user.findFirst({
        where: { azure_oid: du.oid, deleted_at: null },
        select: { id: true, is_active: true },
      });
      if (!user) continue; // only reconcile users who have logged in at least once

      await this.applyAdRolesToUser(user.id, du.groupIds);
      usersProcessed++;

      if (!du.accountEnabled && user.is_active) {
        await prisma.user.update({ where: { id: user.id }, data: { is_active: false } });
        deactivated++;
        logger.info('Deactivated user disabled in Azure AD', { userId: user.id });
      }
    }
    logger.info('Directory sync complete', { usersProcessed, deactivated });
    return { usersProcessed, deactivated };
  }

  private async _assertExists(id: string): Promise<void> {
    const m = await prisma.directory_Group_Mapping.findUnique({ where: { id } });
    if (!m) throw AppError.notFound('Directory group mapping');
  }
}

export const directoryMappingService = new DirectoryMappingService();
```

> Confirm the `auditLogService` import path and `log`/`logAsync` DTO field names against `src/modules/logging/service/implementation/`. Match the existing call-site shape used in `asset.service.ts` exactly; adjust field names if they differ.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/integration/service
git commit -m "feat(integration): directory mapping service + role apply + full sync"
```

---

## Task 5: DTOs, controller, module wiring, mount

**Files:**
- Create: `src/modules/integration/dto/request/directory.request.dto.ts`
- Create: `src/modules/integration/dto/response/directory.response.dto.ts`
- Create: `src/modules/integration/controller/directory-mapping.controller.ts`
- Create: `src/modules/integration/index.ts`
- Modify: `src/server.ts` (route mounting block ~where other `createXxxModule()` mount)

**Interfaces:**
- Consumes: `directoryMappingService` (Task 4).
- Produces: `createIntegrationModule(): Router` mounted at `/api/v1`, exposing the routes below. Consumed by `server.ts` and the frontend (Task 8).

Routes:
```
/integration/directory/mappings            GET     settings:read
/integration/directory/mappings            POST    settings:manage
/integration/directory/mappings/:id        PATCH   settings:manage
/integration/directory/mappings/:id        DELETE  settings:manage
/integration/directory/sync                POST    settings:manage   — manual "sync now"
```

- [ ] **Step 1: Request DTOs**

```ts
// src/modules/integration/dto/request/directory.request.dto.ts
import { z } from 'zod';

export const CreateMappingSchema = z.object({
  adGroupId: z.string().uuid('adGroupId must be the group Object ID (GUID)'),
  adGroupName: z.string().min(1).max(256),
  roleId: z.string().uuid(),
});
export type CreateMappingDto = z.infer<typeof CreateMappingSchema>;

export const UpdateMappingSchema = z.object({
  adGroupName: z.string().min(1).max(256).optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateMappingDto = z.infer<typeof UpdateMappingSchema>;
```

- [ ] **Step 2: Response DTO**

```ts
// src/modules/integration/dto/response/directory.response.dto.ts
import { DirectoryGroupMapping } from '../../service/interface/directory.service.interface';

export interface DirectoryMappingResponse {
  id: string;
  adGroupId: string;
  adGroupName: string;
  roleId: string;
  roleName?: string;
  isActive: boolean;
  createdAt: string;
}

export const mapMappingToResponse = (m: DirectoryGroupMapping): DirectoryMappingResponse => ({
  id: m.id,
  adGroupId: m.adGroupId,
  adGroupName: m.adGroupName,
  roleId: m.roleId,
  roleName: m.roleName,
  isActive: m.isActive,
  createdAt: m.createdAt.toISOString(),
});
```

- [ ] **Step 3: Controller** (mirror `working-paper-template.controller.ts` structure exactly)

```ts
// src/modules/integration/controller/directory-mapping.controller.ts
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { IDirectoryMappingService } from '../service/interface/directory.service.interface';
import {
  CreateMappingSchema, UpdateMappingSchema,
} from '../dto/request/directory.request.dto';
import { mapMappingToResponse } from '../dto/response/directory.response.dto';

export class DirectoryMappingController {
  public readonly router: Router = Router();

  constructor(private readonly service: IDirectoryMappingService) {
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.get('/mappings', authenticate, requirePermission('settings:read'),
      this._list.bind(this));
    this.router.post('/mappings', authenticate, requirePermission('settings:manage'),
      validate(CreateMappingSchema), this._create.bind(this));
    this.router.patch('/mappings/:id', authenticate, requirePermission('settings:manage'),
      validate(UpdateMappingSchema), this._update.bind(this));
    this.router.delete('/mappings/:id', authenticate, requirePermission('settings:manage'),
      this._delete.bind(this));
    this.router.post('/sync', authenticate, requirePermission('settings:manage'),
      this._sync.bind(this));
  }

  /** @route GET /integration/directory/mappings @access settings:read */
  private async _list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await this.service.listMappings();
      res.json(buildResponse(rows.map(mapMappingToResponse), 'Directory mappings retrieved'));
    } catch (err) { next(err); }
  }

  /** @route POST /integration/directory/mappings @access settings:manage */
  private async _create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const m = await this.service.createMapping(req.body, req.user!.id);
      res.status(201).json(buildResponse(mapMappingToResponse(m), 'Mapping created'));
    } catch (err) { next(err); }
  }

  /** @route PATCH /integration/directory/mappings/:id @access settings:manage */
  private async _update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const m = await this.service.updateMapping(req.params.id, req.body, req.user!.id);
      res.json(buildResponse(mapMappingToResponse(m), 'Mapping updated'));
    } catch (err) { next(err); }
  }

  /** @route DELETE /integration/directory/mappings/:id @access settings:manage */
  private async _delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.deleteMapping(req.params.id, req.user!.id);
      res.json(buildResponse(null, 'Mapping deleted'));
    } catch (err) { next(err); }
  }

  /** @route POST /integration/directory/sync @access settings:manage */
  private async _sync(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.service.runFullDirectorySync();
      res.json(buildResponse(result, 'Directory sync complete'));
    } catch (err) { next(err); }
  }
}
```

> Verify `req.user!.id` and `buildResponse` signatures against an existing controller before finalizing — match `asset.controller.ts`.

- [ ] **Step 4: Module factory**

```ts
// src/modules/integration/index.ts
import { Router } from 'express';
import { DirectoryMappingController } from './controller/directory-mapping.controller';
import { directoryMappingService } from './service/implementation/directory-mapping.service';

export const createIntegrationModule = (): Router => {
  const router = Router();
  const controller = new DirectoryMappingController(directoryMappingService);
  router.use('/integration/directory', controller.router);
  return router;
};

export { DirectoryMappingService, directoryMappingService } from './service/implementation/directory-mapping.service';
export type { IDirectoryMappingService } from './service/interface/directory.service.interface';
```

- [ ] **Step 5: Mount in server.ts**

In `src/server.ts`, alongside the other `createXxxModule()` mounts, add:

```ts
import { createIntegrationModule } from './modules/integration';
// ...
app.use(`/api/${config.app.apiVersion}`, createIntegrationModule());
```

(Match the exact mount expression used for `createSettingsModule()` — same prefix variable.)

- [ ] **Step 6: Verify build + manual smoke**

Run: `npm run build`
Expected: PASS.

Then `npm run dev`, log in as `admin@example.com`, and:
```bash
curl -s -X POST localhost:3000/api/v1/integration/directory/mappings \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"adGroupId":"<a-real-guid>","adGroupName":"GBB-Audit-Team","roleId":"<auditor-role-id>"}'
```
Expected: 201 with the mapping; `GET /mappings` lists it.

- [ ] **Step 7: Commit**

```bash
git add src/modules/integration/dto src/modules/integration/controller src/modules/integration/index.ts src/server.ts
git commit -m "feat(integration): directory mapping CRUD routes + module mount"
```

---

## Task 6: Wire group→role into SSO login

**Files:**
- Modify: `src/modules/user/service/interface/user.service.interface.ts` (AzureAdProfile ~87-96)
- Modify: `src/modules/user/service/client/oidc.client.ts` (AzureAdOidcClient.handleCallback ~89-108)
- Modify: `src/modules/user/service/implementation/user.service.ts` (syncFromAzureAd ~521-582)

**Interfaces:**
- Consumes: `directoryMappingService.applyAdRolesToUser` (Task 4), `createGraphDirectoryClient` (Task 3).
- Produces: SSO login now reconciles `azure_ad` roles from the token's `groups` claim (with Graph overage fallback). No new exported signatures.

- [ ] **Step 1: Extend the profile type**

In `user.service.interface.ts`, add to `AzureAdProfile`:

```ts
  groups?: string[];
  groupsOverage?: boolean; // true when Azure omitted groups due to the >150/200 limit
```

- [ ] **Step 2: Extract the groups claim in the OIDC client**

In `oidc.client.ts`, inside `AzureAdOidcClient.handleCallback`, after building `profile`, populate groups. Replace the `profile` object construction so it also sets:

```ts
      const groupsClaim = claims['groups'];
      const claimNames = claims['_claim_names'] as Record<string, unknown> | undefined;

      const profile: AzureAdProfile = {
        oid: claims['oid'] as string,
        email:
          (claims['preferred_username'] as string) ||
          (claims['email'] as string) ||
          (claims['upn'] as string),
        givenName: claims['given_name'] as string | undefined,
        familyName: claims['family_name'] as string | undefined,
        displayName: claims['name'] as string | undefined,
        jobTitle: claims['jobTitle'] as string | undefined,
        department: claims['department'] as string | undefined,
        groups: Array.isArray(groupsClaim) ? (groupsClaim as string[]) : undefined,
        // Azure sets _claim_names.groups when membership overflows the token
        groupsOverage: Boolean(claimNames && 'groups' in claimNames),
      };
```

- [ ] **Step 3: Apply AD roles in syncFromAzureAd**

In `user.service.ts`, add imports at the top:

```ts
import { directoryMappingService } from '../../../integration';
import { createGraphDirectoryClient } from '../../../integration/service/client/graph.client';
```

Then, in `syncFromAzureAd`, after the user exists (both the `existing` update branch and the JIT-create branch), resolve the user id and apply roles. Replace the two `return mapUserToResponse(...)` tails so that **before** returning, you call a shared private helper. Add this helper to the class:

```ts
  private async _applyDirectoryRoles(
    userId: string,
    profile: AzureAdProfile,
  ): Promise<void> {
    try {
      let groupIds = profile.groups ?? [];
      if (profile.groupsOverage) {
        // Token omitted the full list — fetch from Graph.
        groupIds = await createGraphDirectoryClient().getUserGroupIds(profile.oid);
      }
      await directoryMappingService.applyAdRolesToUser(userId, groupIds);
    } catch (err) {
      // Never block login on role-sync failure; user keeps prior roles.
      logger.error('Directory role apply failed during SSO login', { userId, err });
    }
  }
```

In the `existing` branch, before `return mapUserToResponse(updated);`:

```ts
      await this._applyDirectoryRoles(updated.id, profile);
      const refreshed = await prisma.user.findUniqueOrThrow({
        where: { id: updated.id }, include: userWithRolesInclude,
      });
      logger.info('User synced from Azure AD', { userId: existing.id });
      return mapUserToResponse(refreshed);
```

In the JIT branch, change the default-role logic: **only** seed `viewer` when there are no mapped roles is unnecessary here — instead create the user with no roles, then apply directory roles. Replace the `defaultRole`/`user_roles.create` block so the user is created without auto-roles:

```ts
    const created = await prisma.user.create({
      data: {
        azure_oid: azureOid,
        email: profile.email,
        first_name: profile.givenName ?? profile.email.split('@')[0],
        last_name: profile.familyName ?? '',
        display_name: profile.displayName,
        job_title: profile.jobTitle,
        department: profile.department,
        email_verified: true,
      },
      include: userWithRolesInclude,
    });

    await this._applyDirectoryRoles(created.id, profile);
    const provisioned = await prisma.user.findUniqueOrThrow({
      where: { id: created.id }, include: userWithRolesInclude,
    });
    logger.info('User JIT-provisioned from Azure AD', { userId: created.id });
    return mapUserToResponse(provisioned);
```

> **Decision applied:** unmapped SSO users now receive **zero roles** (least privilege), replacing the old auto-`viewer`. If GBB wants the old behavior, they map an "all-staff" group to `viewer`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS. Watch for a circular-import warning between `user` and `integration` — there must be none, because `integration` does not import `user`. If tsc reports a cycle, confirm no integration file imports from `../user`.

- [ ] **Step 5: Manual smoke (if a test Azure tenant is available)**

Log in via SSO with a user in a mapped group; confirm they receive the mapped role and not `viewer`. With sync disabled (stub), overage path returns `[]` — acceptable for local dev.

- [ ] **Step 6: Commit**

```bash
git add src/modules/user/service
git commit -m "feat(integration): apply azure group->role mapping on SSO login with graph overage fallback"
```

---

## Task 7: Nightly Graph sync job

**Files:**
- Modify: `src/modules/background/service/implementation/scheduler.service.ts` (JOB_KEYS ~18-28, registerAllJobs ~200+)

**Interfaces:**
- Consumes: `directoryMappingService.runFullDirectorySync` (Task 4).
- Produces: registered job `BG:INTEGRATION:DIRECTORY:SYNC:DAILY`.

- [ ] **Step 1: Add the job key**

In `JOB_KEYS`, add:

```ts
  INTEGRATION_DIRECTORY_SYNC_DAILY: 'BG:INTEGRATION:DIRECTORY:SYNC:DAILY',
```

- [ ] **Step 2: Register the job**

Add the import near the top of the file:

```ts
import { directoryMappingService } from '../../../integration';
```

Inside `registerAllJobs()`, add:

```ts
  // BG:INTEGRATION:DIRECTORY:SYNC:DAILY — reconcile Azure AD group->role + deprovision
  schedulerService.register({
    key: JOB_KEYS.INTEGRATION_DIRECTORY_SYNC_DAILY,
    name: 'Azure AD Directory Sync',
    description: 'Pulls users + group memberships from Microsoft Graph, reconciles azure_ad roles, and deactivates users disabled in Azure AD',
    cronExpression: '0 2 * * *', // every day at 02:00
    handler: async () => {
      if (!config.directorySync.enabled) {
        logger.info('Directory sync skipped (DIRECTORY_SYNC_ENABLED=false)');
        return;
      }
      const result = await directoryMappingService.runFullDirectorySync();
      logger.info('Directory sync job finished', result);
    },
  });
```

Ensure `config` and `logger` are already imported in this file (they are).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke**

`npm run dev`; on boot the log shows `Background job registered { jobKey: 'BG:INTEGRATION:DIRECTORY:SYNC:DAILY' }`. With sync disabled, a manual `POST /integration/directory/sync` returns `{ usersProcessed: 0, deactivated: 0 }` (stub).

- [ ] **Step 5: Commit**

```bash
git add src/modules/background/service/implementation/scheduler.service.ts
git commit -m "feat(integration): nightly azure ad directory sync background job"
```

---

## Task 8: Frontend — Settings "Directory" tab

> **Frontend lives in `audit-system/frontend/` (separate working dir).** This task can be executed as its own session. Mirror an existing Settings tab (e.g. the role-administration or report-template tab) for table + slide-over form + API client patterns.

**Files (paths to confirm against the frontend tree):**
- Create: `frontend/lib/api/directory.ts` — API client for the 5 routes
- Create: `frontend/app/(dashboard)/settings/_components/DirectoryMappingsTab.tsx`
- Modify: the Settings page tab list to add a permission-gated "Directory" tab (gated on `settings:manage`)

**Interfaces:**
- Consumes: backend routes from Task 5.
- Produces: an admin screen to list/create/edit/delete mappings and trigger "Sync now".

- [ ] **Step 1: API client**

Create `directory.ts` exposing `listMappings()`, `createMapping(body)`, `updateMapping(id, body)`, `deleteMapping(id)`, `syncNow()`, each calling `/api/v1/integration/directory/...` through the existing BFF fetch wrapper. Match the shape of an existing `lib/api/*.ts` client.

- [ ] **Step 2: Tab component**

A table of mappings (`AD Group Name`, `AD Group ID`, `Role`, `Active`), a "New mapping" slide-over (group id + group name + role dropdown sourced from the existing roles endpoint), edit/delete row actions, and a "Sync now" button calling `syncNow()`. Gate the whole tab and its actions on the `settings:manage` permission using the existing permission hook.

- [ ] **Step 3: Use ui-ux-pro-max for styling**

Per project preference (memory `feedback_use_ui_ux_pro_max`), run the ui-ux-pro-max skill for the visual/styling pass on the new tab.

- [ ] **Step 4: Verify frontend build**

Run (in `frontend/`): `npm run build`
Expected: production build passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api/directory.ts frontend/app
git commit -m "feat(integration): settings directory-mappings tab"
```

---

## Task 9: Docs + open-question resolution

**Files:**
- Modify: `docs/PROJECT_STATE.md` (add a rev changelog row + flip Integration status), `CLAUDE.md` (§9 open questions)

- [ ] **Step 1: Resolve the identity open question**

In `CLAUDE.md` §9, update "Final identity system" to: *"Resolved — Entra ID (Azure AD) via OIDC for login + Microsoft Graph (app-only) for nightly directory sync. AD security groups map to IAMS roles via `directory_group_mappings`."*

- [ ] **Step 2: Add a PROJECT_STATE rev changelog**

Add a new top `> **rev NN changelog:**` entry summarizing: new `integration/` module; `directory_group_mappings` table; `user_roles.source`; SSO login + nightly Graph sync apply group→role; unmapped SSO users now get zero roles (was `viewer`); Settings Directory tab. Update §4.2 to move `integration/` partially out of "entirely missing" (directory sync built; Dynafin/IMOC/AD-attribute adapters still pending).

- [ ] **Step 3: Commit**

```bash
git add docs/PROJECT_STATE.md CLAUDE.md
git commit -m "docs: record azure ad group->role integration; resolve identity open question"
```

---

## Self-Review

**Spec coverage:**
- Membership→role mapping table → Task 1 (schema), Task 4/5 (CRUD). ✅
- Hybrid manual + azure_ad authority via `source` → Task 1 (column), Task 2 (reconciler keeps manual), Task 4 (scoped delete). ✅
- AD security groups → IAMS roles → Task 4 `resolveRolesForGroups`. ✅
- Login JIT apply → Task 6. ✅
- Nightly Graph sync + deprovision → Task 4 `runFullDirectorySync`, Task 7 (job). ✅
- Overage fallback → Task 6 (graph `getUserGroupIds`). ✅
- Local login unaffected → no change to local path; `source` defaults `manual`; sync scoped to `azure_ad`. ✅
- SSO-only for staff / unmapped = zero roles → Task 6 decision note. ✅
- Read-only external rule → Graph client only GETs. ✅

**Placeholder scan:** No TODO/TBD; every code step shows real code. Two "verify against existing controller/audit-log call-site" notes are deliberate consistency checks, not missing code.

**Type consistency:** `reconcileAdRoles(currentRoles, desiredRoleIds)` signature identical in Tasks 2/4. `applyAdRolesToUser(userId, groupIds)`, `resolveRolesForGroups(groupIds)`, `runFullDirectorySync()` consistent across Tasks 4/6/7. `source` literals `'manual'`/`'azure_ad'` consistent. `IGraphDirectoryClient` methods consistent across Tasks 3/4/6.

**Known follow-ups (out of scope, flag to Wole):** double-MFA decision (Entra Conditional Access vs IAMS 2FA); whether to seed an "all-staff → viewer" mapping to preserve old default; Graph pagination (`@odata.nextLink`) if the tenant exceeds 999 users.
