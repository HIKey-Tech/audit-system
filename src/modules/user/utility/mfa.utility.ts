// src/modules/user/utility/mfa.utility.ts
import crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { generateSecret, verifySync, generateURI } from 'otplib';
import { config } from '../../../shared/config/app.config';

// ── Scoped short-lived tokens ─────────────────────────────────
// Reused for the two intermediate login states. Signed with the same JWT
// secret as access tokens but carry a `scope` claim; the access-token guard
// rejects any token that has a scope, so these can never act as access tokens.

export type MfaScope = 'mfa_enroll' | 'mfa_challenge';

export interface ScopedTokenPayload {
  sub: string;
  email: string;
  scope: MfaScope;
}

export const generateScopedToken = (
  sub: string,
  email: string,
  scope: MfaScope,
  expiresIn: string,
): string =>
  jwt.sign({ sub, email, scope }, config.jwt.secret, {
    expiresIn,
    algorithm: 'HS256',
  } as jwt.SignOptions);

export const verifyScopedToken = (
  token: string,
  expectedScope: MfaScope,
): { sub: string; email: string } => {
  const payload = jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
  }) as ScopedTokenPayload & {
    iat: number;
    exp: number;
  };
  if (payload.scope !== expectedScope) {
    throw new Error(`Invalid token scope: expected ${expectedScope}`);
  }
  return { sub: payload.sub, email: payload.email };
};

// ── TOTP (authenticator app) ──────────────────────────────────

export const generateTotpSecret = (): string => generateSecret();

export const buildTotpUri = (email: string, secret: string): string =>
  generateURI({
    strategy: 'totp',
    secret,
    label: email,
    issuer: config.mfa.issuer,
  });

export const verifyTotp = (token: string, secret: string): boolean => {
  try {
    // ±30s tolerance (one time step either side) absorbs minor clock drift.
    const result = verifySync({ token: token.trim(), secret, epochTolerance: 30 });
    return Boolean(result?.valid);
  } catch {
    // otplib throws TokenLengthError / TokenFormatError for any token that isn't
    // exactly 6 digits (e.g. a backup code like "a1b2c-3d4e5"). Treat a malformed
    // token as "not a TOTP match" so verifyChallenge falls through to the
    // backup-code check instead of surfacing a 500.
    return false;
  }
};

// ── TOTP secret encryption at rest (AES-256-GCM) ──────────────

const ENC_KEY = crypto.scryptSync(
  config.mfa.encryptionKey || config.jwt.secret,
  'iams-mfa-totp',
  32,
);

export const encryptSecret = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
};

export const decryptSecret = (encoded: string): string => {
  const [ivB64, tagB64, dataB64] = encoded.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted secret');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    ENC_KEY,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
};

// ── Email OTP ─────────────────────────────────────────────────

export const generateEmailOtp = (): string =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

// ── Backup recovery codes ─────────────────────────────────────

/** Produce N human-friendly single-use codes, e.g. "a1b2c-3d4e5". */
export const generateBackupCodes = (count: number): string[] =>
  Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex'); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });

/** Normalise for comparison: strip separators, lowercase. */
export const normaliseBackupCode = (code: string): string =>
  code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
