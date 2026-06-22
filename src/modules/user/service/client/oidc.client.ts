// src/modules/user/service/client/oidc.client.ts
import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node';
import { Issuer, generators, TokenSet } from 'openid-client';
import { config } from '../../../../shared/config/app.config';
import { logger } from '../../../../shared/utils/logger.util';
import { AppError, ErrorCode } from '../../../../shared/errors/app.error';
import { AzureAdProfile } from '../interface/user.service.interface';

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

    // Store verifier in a short-lived cache keyed by state
    // In production use Redis; here we use an in-memory map
    stateVerifierMap.set(generatedState, verifier);
    setTimeout(() => stateVerifierMap.delete(generatedState), 10 * 60 * 1000);

    return { url, state: generatedState };
  }

  async handleCallback(code: string, state: string): Promise<OidcAuthResult> {
    if (!state) {
      throw AppError.unauthorized('Missing SSO state — possible CSRF attempt');
    }

    const verifier = stateVerifierMap.get(state);
    if (!verifier) {
      throw AppError.unauthorized(
        'Invalid or expired SSO state — possible CSRF attempt',
      );
    }

    // Consume the state immediately so it cannot be replayed, regardless
    // of whether the token exchange below succeeds or fails.
    stateVerifierMap.delete(state);

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

    stateVerifierMap.set(generatedState, codeVerifier);
    stateNonceMap.set(generatedState, nonce);
    setTimeout(() => {
      stateVerifierMap.delete(generatedState);
      stateNonceMap.delete(generatedState);
    }, 10 * 60 * 1000);

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

    const codeVerifier = stateVerifierMap.get(state);
    const nonce = stateNonceMap.get(state);
    if (!codeVerifier || !nonce) {
      throw AppError.unauthorized(
        'Invalid or expired SSO state — possible CSRF attempt',
      );
    }

    // Consume state/nonce/verifier immediately to prevent replay.
    stateVerifierMap.delete(state);
    stateNonceMap.delete(state);

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

// In-memory state storage (replace with Redis in production)
const stateVerifierMap = new Map<string, string>();
const stateNonceMap = new Map<string, string>();

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