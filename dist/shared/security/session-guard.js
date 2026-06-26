"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSessionValid = exports.setUserActiveSnapshot = exports.revokeUserSessions = void 0;
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
const cache_client_1 = require("../cache/cache.client");
const prisma_client_1 = require("../prisma/prisma.client");
const app_error_1 = require("../errors/app.error");
// Cover the maximum refresh-token lifetime so a watermark outlives any access
// token that could still be replayed.
const REVOKE_TTL_SECONDS = 7 * 24 * 60 * 60;
// How long an "is active" snapshot is trusted before re-reading the DB. This is
// also the worst-case delay before a deactivation locks a user out.
const ACTIVE_TTL_SECONDS = 60;
const revokeKey = (userId) => `auth:revokeBefore:${userId}`;
const activeKey = (userId) => `auth:active:${userId}`;
/**
 * Invalidate every access token issued to this user up to now. The user's
 * refresh token(s) must be handled separately (revoke for a hard logout, or keep
 * for a silent permission refresh — the next refresh mints a token that passes).
 */
const revokeUserSessions = async (userId) => {
    await cache_client_1.cache.set(revokeKey(userId), Math.floor(Date.now() / 1000), REVOKE_TTL_SECONDS);
};
exports.revokeUserSessions = revokeUserSessions;
/** Update the cached liveness snapshot (e.g. on activate/deactivate). */
const setUserActiveSnapshot = async (userId, isActive) => {
    await cache_client_1.cache.set(activeKey(userId), isActive, ACTIVE_TTL_SECONDS);
};
exports.setUserActiveSnapshot = setUserActiveSnapshot;
/**
 * Reject the request if the user has been deactivated/deleted or the token was
 * issued before a revocation watermark. Throws `AppError.unauthorized` on
 * failure; returns normally otherwise.
 */
const assertSessionValid = async (userId, tokenIatSeconds) => {
    const revokeBefore = await cache_client_1.cache.get(revokeKey(userId));
    if (typeof revokeBefore === 'number' &&
        typeof tokenIatSeconds === 'number' &&
        tokenIatSeconds < revokeBefore) {
        throw app_error_1.AppError.unauthorized('Session has been revoked. Please sign in again.');
    }
    let active = await cache_client_1.cache.get(activeKey(userId));
    if (active === null) {
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { id: userId },
            select: { is_active: true, deleted_at: true },
        });
        active = Boolean(user && user.is_active && user.deleted_at === null);
        await cache_client_1.cache.set(activeKey(userId), active, ACTIVE_TTL_SECONDS);
    }
    if (!active) {
        throw app_error_1.AppError.unauthorized('Account is deactivated');
    }
};
exports.assertSessionValid = assertSessionValid;
//# sourceMappingURL=session-guard.js.map