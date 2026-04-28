"use strict";
// src/server.ts
//
// IAMS — Application entry point.
// Boot order: validate config → connect DB → wire Express → start HTTP server → start scheduler.
// Shutdown order: stop accepting connections → stop scheduler → disconnect DB → exit.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const app_config_1 = require("./shared/config/app.config");
const logger_util_1 = require("./shared/utils/logger.util");
const prisma_client_1 = require("./shared/prisma/prisma.client");
const error_handler_middleware_1 = require("./shared/middleware/error-handler.middleware");
const request_logger_middleware_1 = require("./modules/logging/utility/request-logger.middleware");
const user_1 = require("./modules/user");
const document_1 = require("./modules/document");
const audit_1 = require("./modules/audit");
const risk_1 = require("./modules/risk");
const workflow_1 = require("./modules/workflow");
const scheduler_service_1 = require("./modules/background/service/implementation/scheduler.service");
const openapi_util_1 = require("./shared/docs/openapi.util");
const SHUTDOWN_TIMEOUT_MS = 10_000;
const buildApp = () => {
    const app = (0, express_1.default)();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: app_config_1.config.app.url,
        credentials: true,
    }));
    app.use((0, compression_1.default)());
    app.use((0, cookie_parser_1.default)());
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    const morganStream = {
        write: (message) => {
            logger_util_1.logger.info(message.trim());
        },
    };
    app.use((0, morgan_1.default)(app_config_1.config.app.isDev ? 'dev' : 'combined', { stream: morganStream }));
    app.use(request_logger_middleware_1.requestAuditLogger);
    const apiLimiter = (0, express_rate_limit_1.default)({
        windowMs: app_config_1.config.rateLimit.windowMs,
        max: app_config_1.config.rateLimit.max,
        standardHeaders: true,
        legacyHeaders: false,
    });
    const apiPrefix = `/api/${app_config_1.config.app.apiVersion}`;
    app.get('/health', (_req, res) => {
        res.status(200).json({
            status: 'ok',
            service: app_config_1.config.app.name,
            env: app_config_1.config.app.env,
            timestamp: new Date().toISOString(),
        });
    });
    const openApiDocument = (0, openapi_util_1.buildOpenApiDocument)();
    app.get('/docs.json', (_req, res) => {
        res.status(200).json(openApiDocument);
    });
    app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openApiDocument, {
        customSiteTitle: `${app_config_1.config.app.name} — API Docs`,
        swaggerOptions: { persistAuthorization: true },
    }));
    app.use(apiPrefix, apiLimiter);
    app.use(apiPrefix, (0, user_1.createUserModule)());
    app.use(apiPrefix, (0, document_1.createDocumentModule)());
    app.use(apiPrefix, (0, audit_1.createAuditModule)());
    app.use(apiPrefix, (0, risk_1.createRiskModule)());
    app.use(apiPrefix, (0, workflow_1.createWorkflowModule)());
    app.use(error_handler_middleware_1.notFoundMiddleware);
    app.use(error_handler_middleware_1.errorHandlerMiddleware);
    return app;
};
const startServer = async () => {
    await (0, prisma_client_1.connectDatabase)();
    const app = buildApp();
    const server = http_1.default.createServer(app);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(app_config_1.config.app.port, () => {
            server.removeListener('error', reject);
            resolve();
        });
    });
    logger_util_1.logger.info('IAMS server started', {
        name: app_config_1.config.app.name,
        env: app_config_1.config.app.env,
        port: app_config_1.config.app.port,
        apiPrefix: `/api/${app_config_1.config.app.apiVersion}`,
        docs: `${app_config_1.config.app.url}/docs`,
    });
    (0, scheduler_service_1.registerAllJobs)();
    await scheduler_service_1.schedulerService.startAll();
    return server;
};
const shutdown = async (server, signal) => {
    logger_util_1.logger.info('Shutdown signal received', { signal });
    const forceExit = setTimeout(() => {
        logger_util_1.logger.error('Graceful shutdown timed out — forcing exit', { signal });
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();
    try {
        await new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
        logger_util_1.logger.info('HTTP server closed');
        scheduler_service_1.schedulerService.stopAll();
        logger_util_1.logger.info('Scheduler stopped');
        await (0, prisma_client_1.disconnectDatabase)();
        clearTimeout(forceExit);
        process.exit(0);
    }
    catch (err) {
        logger_util_1.logger.error('Error during graceful shutdown', { err });
        clearTimeout(forceExit);
        process.exit(1);
    }
};
const registerProcessHandlers = (server) => {
    ['SIGTERM', 'SIGINT'].forEach((signal) => {
        process.once(signal, () => {
            void shutdown(server, signal);
        });
    });
    process.on('uncaughtException', (err) => {
        logger_util_1.logger.error('Uncaught exception — terminating process', { err });
        void shutdown(server, 'uncaughtException').finally(() => process.exit(1));
    });
    process.on('unhandledRejection', (reason) => {
        logger_util_1.logger.error('Unhandled promise rejection — terminating process', { reason });
        void shutdown(server, 'unhandledRejection').finally(() => process.exit(1));
    });
};
const bootstrap = async () => {
    try {
        const server = await startServer();
        registerProcessHandlers(server);
    }
    catch (err) {
        logger_util_1.logger.error('Failed to start IAMS server', { err });
        await (0, prisma_client_1.disconnectDatabase)().catch(() => undefined);
        process.exit(1);
    }
};
void bootstrap();
//# sourceMappingURL=server.js.map