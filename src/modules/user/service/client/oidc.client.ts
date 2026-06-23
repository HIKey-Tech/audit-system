// src/modules/user/service/client/oidc.client.ts
import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node';
import { Issuer, generators, TokenSet } from 'openid-client';
import { config } from '../../../../shared/config/app.config';
import { logger } from '../../../../shared/utils/logger.util';
import { cache } from '../../../../shared/cache/cache.client';
import { AppError, ErrorCode } from '../../../../shared/errors/app.error';
import { AzureAdProfile } from '../interface/user.service.interface';

// SSO login state (PKCE verifier + nonce) is short-lived and must be shared
// across instances so the callback can land on any node — and must survive a
// restart. It lives in the shared cache (Redis in clustered deployments),
// keyed by `state`, and is consumed exactly once on callback.
const OIDC_STATE_TTL_SECONDS = 10 * 60;
const oidcStateKey = (state: string): string => `oidc:state:${state}`;

interface OidcLoginState {
  verifier: string;
  nonce?: string;
}

const putLoginState = (state: string, value: OidcLoginState): Promise<void> =>
  cache.set(oidcStateKey(state), value, OIDC_STATE_TTL_SECONDS);

/** Read and delete the login state in one step (single-use, prevents replay). */
const takeLoginState = async (state: string): Promise<OidcLoginState | null> => {
  const key = oidcStateKey(state);
  const value = await cache.get<OidcLoginState>(key);
  if (value) await cache.del(key);
  return value;
};

export interface OidcAuthResult {
  profile: AzureAdProfile;
  idToken: string;
  accessToken?: string;
}

export interface IOidcClient {
  getAuthorizationUrl(state?: string): Promise<{ url: string; state: string }>;
  handleCallback(code: string, state: string): Promise<OidcAuthResult>;
}

// ──────────────────────────────────────────────
// Azure AD OIDC Client
// ──────────────────────────────────────────────
export class AzureAdOidcClient implements IOidcClient {
  private readonly msalClient: ConfidentialClientApplication;
  private readonly cryptoProvider: CryptoProvider;

  constructor() {
    this.cryptoProvider = new CryptoProvider();
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.oidc.azureAd.clientId,
        clientSecret: config.oidc.azureAd.clientSecret,
        authority: config.oidc.azureAd.authority,
      },
    });
  }

  async getAuthorizationUrl(state?: string): Promise<{ url: string; state: string }> {
    const { verifier, challenge } =
      await this.cryptoProvider.generatePkceCodes();

    const generatedState = state ?? generators.state();

    const url = await this.msalClient.getAuthCodeUrl({
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri: config.oidc.azureAd.redirectUri,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      state: generatedState,
      prompt: 'select_account',
    });

    // Store verifier in the shared, short-lived state store keyed by state.
    await putLoginState(generatedState, { verifier });

    return { url, state: generatedState };
  }

  async handleCallback(code: string, state: string): Promise<OidcAuthResult> {
    if (!state) {
      throw AppError.unauthorized('Missing SSO state — possible CSRF attempt');
    }

    // Consume the state immediately (read+delete) so it cannot be replayed.
    const loginState = await takeLoginState(state);
    if (!loginState) {
      throw AppError.unauthorized(
        'Invalid or expired SSO state — possible CSRF attempt',
      );
    }
    const verifier = loginState.verifier;

    try {
      const tokenResponse = await this.msalClient.acquireTokenByCode({
        code,
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        redirectUri: config.oidc.azureAd.redirectUri,
        codeVerifier: verifier,
      });

      if (!tokenResponse) {
        throw AppError.unauthorized('No token response from Azure AD');
      }

      const claims = tokenResponse.idTokenClaims as Record<string, unknown>;

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
        authMethods: Array.isArray(claims['amr']) ? (claims['amr'] as string[]) : undefined,
        // Single-tenant Entra: the address comes from the org directory and is
        // trusted. (Email/UPN in a controlled tenant cannot be self-asserted.)
        emailVerified: true,
      };

      return {
        profile,
        idToken: tokenResponse.idToken,
        accessToken: tokenResponse.accessToken ?? undefined,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Azure AD OIDC callback failed', { err });
      throw new AppError('SSO authentication failed', 401, ErrorCode.SSO_FAILED);
    }
  }
}

// ──────────────────────────────────────────────
// Generic OIDC Client (Okta, Auth0, Keycloak…)
// ──────────────────────────────────────────────
export class GenericOidcClient implements IOidcClient {
  private clientPromise: Promise<import('openid-client').BaseClient> | null = null;

  private getClient(): Promise<import('openid-client').BaseClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const issuer = await Issuer.discover(config.oidc.generic.issuerUrl);
        return new issuer.Client({
          client_id: config.oidc.generic.clientId,
          client_secret: config.oidc.generic.clientSecret,
          redirect_uris: [config.oidc.generic.redirectUri],
          response_types: ['code'],
        });
      })();
    }
    return this.clientPromise;
  }

  async getAuthorizationUrl(state?: string): Promise<{ url: string; state: string }> {
    const client = await this.getClient();
    const generatedState = state ?? generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    await putLoginState(generatedState, { verifier: codeVerifier, nonce });

    const url = client.authorizationUrl({
      scope: config.oidc.generic.scopes.join(' '),
      state: generatedState,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return { url, state: generatedState };
  }

  async handleCallback(code: string, state: string): Promise<OidcAuthResult> {
    if (!state) {
      throw AppError.unauthorized('Missing SSO state — possible CSRF attempt');
    }

    // Consume state/nonce/verifier immediately (read+delete) to prevent replay.
    const loginState = await takeLoginState(state);
    if (!loginState?.verifier || !loginState.nonce) {
      throw AppError.unauthorized(
        'Invalid or expired SSO state — possible CSRF attempt',
      );
    }
    const codeVerifier = loginState.verifier;
    const nonce = loginState.nonce;

    try {
      const client = await this.getClient();

      const tokenSet: TokenSet = await client.callback(
        config.oidc.generic.redirectUri,
        { code, state },
        { state, nonce, code_verifier: codeVerifier },
      );

      const claims = tokenSet.claims();

      const profile: AzureAdProfile = {
        oid: claims.sub,
        email: (claims['email'] as string) ?? claims['preferred_username'] as string,
        givenName: claims['given_name'] as string | undefined,
        familyName: claims['family_name'] as string | undefined,
        displayName: claims['name'] as string | undefined,
        // Only trust the email for account linking if the IdP says it's verified.
        emailVerified: claims['email_verified'] === true,
      };

      return {
        profile,
        idToken: tokenSet.id_token ?? '',
        accessToken: tokenSet.access_token,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Generic OIDC callback failed', { err });
      throw new AppError('SSO authentication failed', 401, ErrorCode.SSO_FAILED);
    }
  }
}

// ──────────────────────────────────────────────
// Factory — returns the configured OIDC client
// ──────────────────────────────────────────────
export const createOidcClient = (): IOidcClient => {
  switch (config.oidc.provider) {
    case 'azure_ad':
      return new AzureAdOidcClient();
    case 'generic':
      return new GenericOidcClient();
    default:
      throw new Error(`Unsupported OIDC provider: ${config.oidc.provider}`);
  }
};