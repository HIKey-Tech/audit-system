// src/shared/config/app.config.ts
import dotenv from 'dotenv';
import path from 'path';
import ms from 'ms';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const optionalEnv = (key: string, fallback = ''): string =>
  process.env[key] ?? fallback;

/**
 * Validates that a duration env value is a string with an explicit time unit
 * (e.g. "15m", "7d") rather than a bare number, which jsonwebtoken/ms would
 * silently interpret as milliseconds and produce near-instant expirations.
 */
const requireDurationEnv = (key: string, fallback: string): string => {
  const raw = process.env[key];
  const value = (raw ?? fallback).trim();
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    throw new Error(
      `Invalid duration for ${key}: "${value}". Must include a time unit (e.g. "15m", "7d", "1h").`,
    );
  }
  const parsed = ms(value);
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid duration for ${key}: "${value}".`);
  }
  return value;
};

export const config = {
  app: {
    name: optionalEnv('APP_NAME', 'Internal Audit System'),
    url: optionalEnv('APP_URL', 'http://localhost:3000'),
    port: parseInt(optionalEnv('PORT', '3000'), 10),
    env: optionalEnv('NODE_ENV', 'development'),
    apiVersion: optionalEnv('API_VERSION', 'v1'),
    isDev: optionalEnv('NODE_ENV', 'development') === 'development',
    isProd: optionalEnv('NODE_ENV', 'development') === 'production',
    // Public base URL of the Next.js frontend — used to build email links
    // (password-reset, etc.) that land on user-facing pages, not the API.
    frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:3001'),
  },

  passwordReset: {
    tokenTtl: requireDurationEnv('PASSWORD_RESET_TOKEN_TTL', '30m'),
  },

  mfa: {
    // When true, local-password users must enrol in 2FA before gaining access.
    mandatory: optionalEnv('MFA_MANDATORY', 'true') === 'true',
    // Days a not-yet-enrolled user may keep logging in (with a setup prompt)
    // before the mandatory gate hard-blocks them. Starts on their first login.
    gracePeriodDays: parseInt(optionalEnv('MFA_GRACE_PERIOD_DAYS', '7'), 10),
    issuer: optionalEnv('MFA_ISSUER', optionalEnv('APP_NAME', 'IAMS')),
    challengeTtl: requireDurationEnv('MFA_CHALLENGE_TTL', '5m'),
    enrollTtl: requireDurationEnv('MFA_ENROLL_TTL', '15m'),
    emailOtpTtl: requireDurationEnv('MFA_EMAIL_OTP_TTL', '10m'),
    emailOtpMaxAttempts: parseInt(optionalEnv('MFA_EMAIL_OTP_MAX_ATTEMPTS', '5'), 10),
    backupCodeCount: parseInt(optionalEnv('MFA_BACKUP_CODE_COUNT', '10'), 10),
    // 32-byte key (hex or base64) for AES-256-GCM at-rest encryption of TOTP
    // secrets. Falls back to a key derived from JWT_SECRET when unset (dev only).
    encryptionKey: optionalEnv('MFA_ENCRYPTION_KEY'),
  },

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: requireDurationEnv('JWT_EXPIRES_IN', '15m'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    refreshExpiresIn: requireDurationEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
    // Window after a token is rotated during which the just-rotated token may
    // still be presented without tripping theft detection. Absorbs benign
    // concurrent refreshes from multiple tabs/devices sharing one cookie.
    refreshRotationGrace: requireDurationEnv('JWT_REFRESH_ROTATION_GRACE', '30s'),
  },

  oidc: {
    provider: optionalEnv('OIDC_PROVIDER', 'azure_ad') as 'azure_ad' | 'generic',
    // Azure AD specific
    azureAd: {
      tenantId: optionalEnv('AZURE_AD_TENANT_ID'),
      clientId: optionalEnv('AZURE_AD_CLIENT_ID'),
      clientSecret: optionalEnv('AZURE_AD_CLIENT_SECRET'),
      redirectUri: optionalEnv('AZURE_AD_REDIRECT_URI', 'http://localhost:3000/api/v1/auth/callback'),
      logoutUri: optionalEnv('AZURE_AD_LOGOUT_URI', 'http://localhost:3000'),
      authority: `https://login.microsoftonline.com/${optionalEnv('AZURE_AD_TENANT_ID')}`,
    },
    // Generic OIDC
    generic: {
      issuerUrl: optionalEnv('OIDC_ISSUER_URL'),
      clientId: optionalEnv('OIDC_CLIENT_ID'),
      clientSecret: optionalEnv('OIDC_CLIENT_SECRET'),
      redirectUri: optionalEnv('OIDC_REDIRECT_URI', 'http://localhost:3000/api/v1/auth/callback'),
      scopes: optionalEnv('OIDC_SCOPES', 'openid profile email').split(' '),
    },
  },

  directorySync: {
    // Reuses the Azure AD app registration; needs Graph application
    // permissions User.Read.All + GroupMember.Read.All (admin-consented).
    enabled: optionalEnv('DIRECTORY_SYNC_ENABLED', 'false') === 'true',
    tenantId: optionalEnv('AZURE_AD_TENANT_ID'),
    clientId: optionalEnv('AZURE_AD_CLIENT_ID'),
    clientSecret: optionalEnv('AZURE_AD_CLIENT_SECRET'),
    graphBaseUrl: optionalEnv('GRAPH_BASE_URL', 'https://graph.microsoft.com/v1.0'),
  },

  redis: {
    url: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
    password: optionalEnv('REDIS_PASSWORD'),
    ttl: parseInt(optionalEnv('REDIS_TTL', '3600'), 10),
  },

  cache: {
    // 'redis' in shared/clustered deployments; 'memory' for local dev / single
    // instance. The Redis client degrades to a cache-miss (never throws) if the
    // server is unreachable, so this only selects the preferred backend.
    driver: optionalEnv('CACHE_DRIVER', 'memory') as 'redis' | 'memory',
  },

  email: {
    host: optionalEnv('SMTP_HOST', 'smtp.gmail.com'),
    port: parseInt(optionalEnv('SMTP_PORT', '587'), 10),
    secure: optionalEnv('SMTP_SECURE', 'false') === 'true',
    user: optionalEnv('SMTP_USER'),
    password: optionalEnv('SMTP_PASSWORD'),
    from: optionalEnv('EMAIL_FROM', 'noreply@yourcompany.com'),
  },

  storage: {
    provider: optionalEnv('STORAGE_PROVIDER', 'local') as 'local' | 'azure_blob' | 'aws_s3',
    localPath: optionalEnv('STORAGE_LOCAL_PATH', './uploads'),
    azure: {
      connectionString: optionalEnv('AZURE_STORAGE_CONNECTION_STRING'),
      container: optionalEnv('AZURE_STORAGE_CONTAINER', 'audit-documents'),
    },
    aws: {
      region: optionalEnv('AWS_REGION', 'eu-west-1'),
      bucket: optionalEnv('AWS_S3_BUCKET'),
      prefix: optionalEnv('AWS_S3_PREFIX'),
      signedUrlTtlSeconds: parseInt(optionalEnv('AWS_S3_SIGNED_URL_TTL_SECONDS', '300'), 10),
      forcePathStyle: optionalEnv('AWS_S3_FORCE_PATH_STYLE', 'false') === 'true',
    },
  },

  rateLimit: {
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    // A single dashboard load fans out ~9 requests; 100/15min throttled normal
    // SPA usage. 600/15min (~40 req/min sustained) is realistic per client.
    max: parseInt(optionalEnv('RATE_LIMIT_MAX_REQUESTS', '600'), 10),
    // Strict cap on credential/OTP endpoints — counts FAILED attempts only, so
    // legitimate users are never throttled while brute force is blocked.
    authMax: parseInt(optionalEnv('RATE_LIMIT_AUTH_MAX', '10'), 10),
  },

  logging: {
    level: optionalEnv('LOG_LEVEL', 'info'),
    format: optionalEnv('LOG_FORMAT', 'json'),
  },

  dataWarehouse: {
    url: optionalEnv('DATA_WAREHOUSE_URL'),
    apiKey: optionalEnv('DATA_WAREHOUSE_API_KEY'),
  },
} as const;

export type AppConfig = typeof config;
