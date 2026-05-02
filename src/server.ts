// src/server.ts
//
// IAMS — Application entry point.
// Boot order: validate config → connect DB → wire Express → start HTTP server → start scheduler.
// Shutdown order: stop accepting connections → stop scheduler → disconnect DB → exit.

import http from 'http';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan, { StreamOptions } from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { config } from './shared/config/app.config';
import { logger } from './shared/utils/logger.util';
import { connectDatabase, disconnectDatabase } from './shared/prisma/prisma.client';
import {
  errorHandlerMiddleware,
  notFoundMiddleware,
} from './shared/middleware/error-handler.middleware';
import { requestAuditLogger } from './modules/logging/utility/request-logger.middleware';
import { createLoggingModule } from './modules/logging';
import { createUserModule } from './modules/user';
import { createDocumentModule } from './modules/document';
import { createAuditModule } from './modules/audit';
import { createRiskModule } from './modules/risk';
import { createWorkflowModule } from './modules/workflow';
import { createMessagingModule } from './modules/messaging';
import { createDashboardModule } from './modules/dashboard';
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

  const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
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

  app.use(apiPrefix, apiLimiter);
  app.use(apiPrefix, createUserModule());
  app.use(apiPrefix, createDocumentModule());
  app.use(apiPrefix, createAuditModule());
  app.use(apiPrefix, createRiskModule());
  app.use(apiPrefix, createWorkflowModule());
  app.use(apiPrefix, createMessagingModule());
  app.use(apiPrefix, createLoggingModule());
  app.use(apiPrefix, createBackgroundModule());
  app.use(apiPrefix, createDashboardModule());

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
};

const startServer = async (): Promise<http.Server> => {
  await connectDatabase();

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

  registerAllJobs();
  await schedulerService.startAll();

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
