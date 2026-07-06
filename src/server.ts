// src/server.ts
//
// IAMS — Application entry point.
// Boot order: validate config → connect DB → wire Express → start HTTP server → start scheduler.
// Shutdown order: stop accepting connections → stop scheduler → disconnect DB → exit.
//implement done
import http from 'http';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan, { StreamOptions } from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import jwt from 'jsonwebtoken';

import { config } from './shared/config/app.config';
import { logger } from './shared/utils/logger.util';
import { connectDatabase, disconnectDatabase } from './shared/prisma/prisma.client';
import { cache } from './shared/cache/cache.client';
import { verifyStorageReady } from './modules/document/service/client/storage.client';
import { warnOnUnresolvableEscalationTargets } from './modules/workflow/utility/workflow.utility';
import {
  errorHandlerMiddleware,
  notFoundMiddleware,
} from './shared/middleware/error-handler.middleware';
import { requestAuditLogger } from './modules/logging/utility/request-logger.middleware';
import { createLoggingModule } from './modules/logging';
import { createUserModule } from './modules/user';
import { createDocumentModule } from './modules/document';
import { createAssetModule } from './modules/asset';
import { createAuditModule } from './modules/audit';
import { createRiskModule } from './modules/risk';
import { createWorkflowModule } from './modules/workflow';
import { createMessagingModule } from './modules/messaging';
import { createDashboardModule } from './modules/dashboard';
import { createSettingsModule } from './modules/settings';
import { createIntegrationModule } from './modules/integration';
import {
  createBackgroundModule,
  schedulerService,
  registerAllJobs,
} from './modules/background';
import { buildOpenApiDocument } from './shared/docs/openapi.util';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const buildApp = (): Application => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: config.app.url,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const morganStream: StreamOptions = {
    write: (message: string) => {
      logger.info(message.trim());
    },
  };
  app.use(morgan(config.app.isDev ? 'dev' : 'combined', { stream: morganStream }));

  app.use(requestAuditLogger);

  // Respond to rate-limited requests with the app's standard JSON envelope (the
  // library default is plain text, which the frontend can't parse) plus a
  // Retry-After hint so the UI can tell the user how long to wait.
  const rateLimitHandler =
    (message: string) =>
      (req: Request, res: Response): void => {
        const { rateLimit: info } = req as Request & { rateLimit?: { resetTime?: Date } };
        const resetMs = info?.resetTime?.getTime() ?? Date.now();
        const retryAfter = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        res.status(429).json({
          success: false,
          message: `${message} Please try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
          errors: { retryAfterSeconds: retryAfter },
          timestamp: new Date().toISOString(),
        });
      };

  // Key by the authenticated user when possible, not just IP — many GBB users sit
  // behind the same NAT/VPN egress IP, and IP-only keying would throttle all of
  // them as one bucket. Falls back to IP for unauthenticated/public requests.
  // Decoding here (ahead of the per-route `authenticate` middleware) is a
  // read-only lookup of the `sub` claim; it does not replace or skip real auth.
  const apiLimiterKeyGenerator = (req: Request): string => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHeader.slice(7), config.jwt.secret, {
          algorithms: ['HS256'],
        }) as { sub?: string };
        if (payload.sub) return `user:${payload.sub}`;
      } catch {
        // Invalid/expired token — fall through to IP keying below.
      }
    }
    return `ip:${req.ip}`;
  };

  const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: apiLimiterKeyGenerator,
    handler: rateLimitHandler('Too many requests.'),
    // On by default everywhere; only skipped when a developer explicitly opts
    // out (RATE_LIMIT_DISABLED=true) in a non-production env. Never skipped in prod.
    skip: () => config.rateLimit.disabled,
  });

  // Brute-force guard for credential/OTP endpoints. skipSuccessfulRequests means
  // only failed attempts count toward the cap, so a real user logging in (even
  // after the dashboard burns through requests) is never locked out — only
  // repeated wrong passwords / OTP codes are throttled.
  const authLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.authMax,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: rateLimitHandler('Too many failed attempts.'),
    skip: () => config.rateLimit.disabled,
  });

  const apiPrefix = `/api/${config.app.apiVersion}`;

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: config.app.name,
      env: config.app.env,
      timestamp: new Date().toISOString(),
    });
  });

  // API docs publish the full route/schema surface — do not expose them to
  // anonymous callers in production. Served only outside production.
  if (!config.app.isProd) {
    const openApiDocument = buildOpenApiDocument();
    app.get('/docs.json', (_req: Request, res: Response) => {
      res.status(200).json(openApiDocument);
    });
    app.use(
      '/docs',
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument, {
        customSiteTitle: `${config.app.name} — API Docs`,
        swaggerOptions: { persistAuthorization: true },
      }),
    );
  }

  // Strict limiter on credential/OTP surfaces (before the general limiter so the
  // tighter cap applies there); general limiter for everything else.
  app.use(`${apiPrefix}/auth/login`, authLimiter);
  app.use(`${apiPrefix}/auth/2fa`, authLimiter);
  app.use(`${apiPrefix}/auth/reset-password`, authLimiter);
  app.use(apiPrefix, apiLimiter);
  app.use(apiPrefix, createUserModule());
  app.use(apiPrefix, createDocumentModule());
  app.use(apiPrefix, createAssetModule());
  app.use(apiPrefix, createAuditModule());
  app.use(apiPrefix, createRiskModule());
  app.use(apiPrefix, createWorkflowModule());
  app.use(apiPrefix, createMessagingModule());
  app.use(apiPrefix, createLoggingModule());
  app.use(apiPrefix, createBackgroundModule());
  app.use(apiPrefix, createDashboardModule());
  app.use(apiPrefix, createSettingsModule());
  app.use(apiPrefix, createIntegrationModule());

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
};

const startServer = async (): Promise<http.Server> => {
  await verifyStorageReady();
  await connectDatabase();
  await cache.connect();

  const app = buildApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.app.port, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  logger.info('IAMS server started', {
    name: config.app.name,
    env: config.app.env,
    port: config.app.port,
    apiPrefix: `/api/${config.app.apiVersion}`,
    docs: `${config.app.url}/docs`,
  });

  if (config.rateLimit.disabled) {
    logger.warn(
      'Rate limiting is DISABLED (RATE_LIMIT_DISABLED=true in a non-production env). ' +
      'Brute-force protection is off — never use this configuration in production.',
    );
  }

  registerAllJobs();
  await schedulerService.startAll();

  void warnOnUnresolvableEscalationTargets();

  return server;
};

const shutdown = async (server: http.Server, signal: string): Promise<void> => {
  logger.info('Shutdown signal received', { signal });

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit', { signal });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    logger.info('HTTP server closed');

    schedulerService.stopAll();
    logger.info('Scheduler stopped');

    await cache.disconnect();
    await disconnectDatabase();

    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', { err });
    clearTimeout(forceExit);
    process.exit(1);
  }
};

const registerProcessHandlers = (server: http.Server): void => {
  (['SIGTERM', 'SIGINT'] as const).forEach((signal) => {
    process.once(signal, () => {
      void shutdown(server, signal);
    });
  });

  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught exception — terminating process', { err });
    void shutdown(server, 'uncaughtException').finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection — terminating process', { reason });
    void shutdown(server, 'unhandledRejection').finally(() => process.exit(1));
  });
};

const bootstrap = async (): Promise<void> => {
  try {
    const server = await startServer();
    registerProcessHandlers(server);
  } catch (err) {
    logger.error('Failed to start IAMS server', { err });
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  }
};

void bootstrap();
