// src/shared/config/app.config.ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const optionalEnv = (key: string, fallback = ''): string =>
  process.env[key] ?? fallback;

export const config = {
  app: {
    name: optionalEnv('APP_NAME', 'Internal Audit System'),
    url: optionalEnv('APP_URL', 'http://localhost:3000'),
    port: parseInt(optionalEnv('PORT', '3000'), 10),
    env: optionalEnv('NODE_ENV', 'development'),
    apiVersion: optionalEnv('API_VERSION', 'v1'),
    isDev: optionalEnv('NODE_ENV', 'development') === 'development',
    isProd: optionalEnv('NODE_ENV', 'development') === 'production',
  },

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  jwt: {
    secret: optionalEnv('JWT_SECRET', 'fallback-dev-secret-DO-NOT-USE-IN-PROD'),
    expiresIn: optionalEnv('JWT_EXPIRES_IN', '15'),
    refreshSecret: optionalEnv('JWT_REFRESH_SECRET', 'fallback-refresh-secret-DO-NOT-USE-IN-PROD'),
    refreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7'),
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

  redis: {
    url: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
    password: optionalEnv('REDIS_PASSWORD'),
    ttl: parseInt(optionalEnv('REDIS_TTL', '3600'), 10),
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
  },

  rateLimit: {
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optionalEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
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
