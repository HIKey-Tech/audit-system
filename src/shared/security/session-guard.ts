// src/shared/security/session-guard.ts
//
// Bounds the lifetime of already-issued JWT access tokens after a privileged
// state change (deactivation, password change, logout-all, role change). Access
// tokens are stateless and otherwise valid until they expire, so without this a
// deactivated or de-provisioned user keeps full access for the whole token TTL.
//
// Design: a short-TTL "is active" snapshot avoids a DB read on every request,
// and a per-user "revoke before" watermark invalidates any token issued before a
// revocation event. Backed by the shared cache (Redis in clustered deployments,
// in-memory otherwise). The cache HARD RULE applies — it never throws — so if the
// cache is unavailable this degrades to an authoritative DB check for liveness
// and simply cannot enforce the watermark (access tokens are short-lived and the
// refresh-token store remains the authoritative revocation path).
import { cache } from '../cache/cache.client';
import { prisma } from '../prisma/prisma.client';
import { AppError } from '../errors/app.error';

// Cover the maximum refresh-token lifetime so a watermark outlives any access
// token that could still be replayed.
const REVOKE_TTL_SECONDS = 7 * 24 * 60 * 60;
// How long an "is active" snapshot is trusted before re-reading the DB. This is
// also the worst-case delay before a deactivation locks a user out.
const ACTIVE_TTL_SECONDS = 60;

const revokeKey = (userId: string): string => `auth:revokeBefore:${userId}`;
const activeKey = (userId: string): string => `auth:active:${userId}`;

/**
 * Invalidate every access token issued to this user up to now. The user's
 * refresh token(s) must be handled separately (revoke for a hard logout, or keep
 * for a silent permission refresh — the next refresh mints a token that passes).
 */
export const revokeUserSessions = async (userId: string): Promise<void> => {
  await cache.set(revokeKey(userId), Math.floor(Date.now() / 1000), REVOKE_TTL_SECONDS);
};

/** Update the cached liveness snapshot (e.g. on activate/deactivate). */
export const setUserActiveSnapshot = async (
  userId: string,
  isActive: boolean,
): Promise<void> => {
  await cache.set(activeKey(userId), isActive, ACTIVE_TTL_SECONDS);
};

/**
 * Reject the request if the user has been deactivated/deleted or the token was
 * issued before a revocation watermark. Throws `AppError.unauthorized` on
 * failure; returns normally otherwise.
 */
export const assertSessionValid = async (
  userId: string,
  tokenIatSeconds: number | undefined,
): Promise<void> => {
  const revokeBefore = await cache.get<number>(revokeKey(userId));
  if (
    typeof revokeBefore === 'number' &&
    typeof tokenIatSeconds === 'number' &&
    tokenIatSeconds < revokeBefore
  ) {
    throw AppError.unauthorized('Session has been revoked. Please sign in again.');
  }

  let active = await cache.get<boolean>(activeKey(userId));
  if (active === null) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { is_active: true, deleted_at: true },
    });
    active = Boolean(user && user.is_active && user.deleted_at === null);
    await cache.set(activeKey(userId), active, ACTIVE_TTL_SECONDS);
  }

  if (!active) {
    throw AppError.unauthorized('Account is deactivated');
  }
};
