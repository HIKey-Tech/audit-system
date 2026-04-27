"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOidcClient = exports.GenericOidcClient = exports.AzureAdOidcClient = void 0;
// src/modules/user/service/client/oidc.client.ts
const msal_node_1 = require("@azure/msal-node");
const openid_client_1 = require("openid-client");
const app_config_1 = require("../../../../shared/config/app.config");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_error_1 = require("../../../../shared/errors/app.error");
// ──────────────────────────────────────────────
// Azure AD OIDC Client
// ──────────────────────────────────────────────
class AzureAdOidcClient {
    msalClient;
    cryptoProvider;
    constructor() {
        this.cryptoProvider = new msal_node_1.CryptoProvider();
        this.msalClient = new msal_node_1.ConfidentialClientApplication({
            auth: {
                clientId: app_config_1.config.oidc.azureAd.clientId,
                clientSecret: app_config_1.config.oidc.azureAd.clientSecret,
                authority: app_config_1.config.oidc.azureAd.authority,
            },
        });
    }
    async getAuthorizationUrl(state) {
        const { verifier, challenge } = await this.cryptoProvider.generatePkceCodes();
        const generatedState = state ?? openid_client_1.generators.state();
        const url = await this.msalClient.getAuthCodeUrl({
            scopes: ['openid', 'profile', 'email', 'User.Read'],
            redirectUri: app_config_1.config.oidc.azureAd.redirectUri,
            codeChallenge: challenge,
            codeChallengeMethod: 'S256',
            state: generatedState,
            prompt: 'select_account',
        });
        // Store verifier in a short-lived cache keyed by state
        // In production use Redis; here we use an in-memory map
        stateVerifierMap.set(generatedState, verifier);
        setTimeout(() => stateVerifierMap.delete(generatedState), 10 * 60 * 1000);
        return { url, state: generatedState };
    }
    async handleCallback(code, state) {
        if (!state) {
            throw app_error_1.AppError.unauthorized('Missing SSO state — possible CSRF attempt');
        }
        const verifier = stateVerifierMap.get(state);
        if (!verifier) {
            throw app_error_1.AppError.unauthorized('Invalid or expired SSO state — possible CSRF attempt');
        }
        // Consume the state immediately so it cannot be replayed, regardless
        // of whether the token exchange below succeeds or fails.
        stateVerifierMap.delete(state);
        try {
            const tokenResponse = await this.msalClient.acquireTokenByCode({
                code,
                scopes: ['openid', 'profile', 'email', 'User.Read'],
                redirectUri: app_config_1.config.oidc.azureAd.redirectUri,
                codeVerifier: verifier,
            });
            if (!tokenResponse) {
                throw app_error_1.AppError.unauthorized('No token response from Azure AD');
            }
            const claims = tokenResponse.idTokenClaims;
            const profile = {
                oid: claims['oid'],
                email: claims['preferred_username'] ||
                    claims['email'] ||
                    claims['upn'],
                givenName: claims['given_name'],
                familyName: claims['family_name'],
                displayName: claims['name'],
                jobTitle: claims['jobTitle'],
                department: claims['department'],
            };
            return {
                profile,
                idToken: tokenResponse.idToken,
                accessToken: tokenResponse.accessToken ?? undefined,
            };
        }
        catch (err) {
            if (err instanceof app_error_1.AppError)
                throw err;
            logger_util_1.logger.error('Azure AD OIDC callback failed', { err });
            throw new app_error_1.AppError('SSO authentication failed', 401, app_error_1.ErrorCode.SSO_FAILED);
        }
    }
}
exports.AzureAdOidcClient = AzureAdOidcClient;
// ──────────────────────────────────────────────
// Generic OIDC Client (Okta, Auth0, Keycloak…)
// ──────────────────────────────────────────────
class GenericOidcClient {
    clientPromise = null;
    getClient() {
        if (!this.clientPromise) {
            this.clientPromise = (async () => {
                const issuer = await openid_client_1.Issuer.discover(app_config_1.config.oidc.generic.issuerUrl);
                return new issuer.Client({
                    client_id: app_config_1.config.oidc.generic.clientId,
                    client_secret: app_config_1.config.oidc.generic.clientSecret,
                    redirect_uris: [app_config_1.config.oidc.generic.redirectUri],
                    response_types: ['code'],
                });
            })();
        }
        return this.clientPromise;
    }
    async getAuthorizationUrl(state) {
        const client = await this.getClient();
        const generatedState = state ?? openid_client_1.generators.state();
        const nonce = openid_client_1.generators.nonce();
        const codeVerifier = openid_client_1.generators.codeVerifier();
        const codeChallenge = openid_client_1.generators.codeChallenge(codeVerifier);
        stateVerifierMap.set(generatedState, codeVerifier);
        stateNonceMap.set(generatedState, nonce);
        setTimeout(() => {
            stateVerifierMap.delete(generatedState);
            stateNonceMap.delete(generatedState);
        }, 10 * 60 * 1000);
        const url = client.authorizationUrl({
            scope: app_config_1.config.oidc.generic.scopes.join(' '),
            state: generatedState,
            nonce,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });
        return { url, state: generatedState };
    }
    async handleCallback(code, state) {
        if (!state) {
            throw app_error_1.AppError.unauthorized('Missing SSO state — possible CSRF attempt');
        }
        const codeVerifier = stateVerifierMap.get(state);
        const nonce = stateNonceMap.get(state);
        if (!codeVerifier || !nonce) {
            throw app_error_1.AppError.unauthorized('Invalid or expired SSO state — possible CSRF attempt');
        }
        // Consume state/nonce/verifier immediately to prevent replay.
        stateVerifierMap.delete(state);
        stateNonceMap.delete(state);
        try {
            const client = await this.getClient();
            const tokenSet = await client.callback(app_config_1.config.oidc.generic.redirectUri, { code, state }, { state, nonce, code_verifier: codeVerifier });
            const claims = tokenSet.claims();
            const profile = {
                oid: claims.sub,
                email: claims['email'] ?? claims['preferred_username'],
                givenName: claims['given_name'],
                familyName: claims['family_name'],
                displayName: claims['name'],
            };
            return {
                profile,
                idToken: tokenSet.id_token ?? '',
                accessToken: tokenSet.access_token,
            };
        }
        catch (err) {
            if (err instanceof app_error_1.AppError)
                throw err;
            logger_util_1.logger.error('Generic OIDC callback failed', { err });
            throw new app_error_1.AppError('SSO authentication failed', 401, app_error_1.ErrorCode.SSO_FAILED);
        }
    }
}
exports.GenericOidcClient = GenericOidcClient;
// In-memory state storage (replace with Redis in production)
const stateVerifierMap = new Map();
const stateNonceMap = new Map();
// ──────────────────────────────────────────────
// Factory — returns the configured OIDC client
// ──────────────────────────────────────────────
const createOidcClient = () => {
    switch (app_config_1.config.oidc.provider) {
        case 'azure_ad':
            return new AzureAdOidcClient();
        case 'generic':
            return new GenericOidcClient();
        default:
            throw new Error(`Unsupported OIDC provider: ${app_config_1.config.oidc.provider}`);
    }
};
exports.createOidcClient = createOidcClient;
//# sourceMappingURL=oidc.client.js.map