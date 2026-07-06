"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
//
// IAMS — Application entry point.
// Boot order: validate config → connect DB → wire Express → start HTTP server → start scheduler.
// Shutdown order: stop accepting connections → stop scheduler → disconnect DB → exit.
//implement done
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_config_1 = require("./shared/config/app.config");
const logger_util_1 = require("./shared/utils/logger.util");
const prisma_client_1 = require("./shared/prisma/prisma.client");
const cache_client_1 = require("./shared/cache/cache.client");
const storage_client_1 = require("./modules/document/service/client/storage.client");
const workflow_utility_1 = require("./modules/workflow/utility/workflow.utility");
const error_handler_middleware_1 = require("./shared/middleware/error-handler.middleware");
const request_logger_middleware_1 = require("./modules/logging/utility/request-logger.middleware");
const logging_1 = require("./modules/logging");
const user_1 = require("./modules/user");
const document_1 = require("./modules/document");
const asset_1 = require("./modules/asset");
const audit_1 = require("./modules/audit");
const risk_1 = require("./modules/risk");
const workflow_1 = require("./modules/workflow");
const messaging_1 = require("./modules/messaging");
const dashboard_1 = require("./modules/dashboard");
const settings_1 = require("./modules/settings");
const integration_1 = require("./modules/integration");
const background_1 = require("./modules/background");
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
    // Respond to rate-limited requests with the app's standard JSON envelope (the
    // library default is plain text, which the frontend can't parse) plus a
    // Retry-After hint so the UI can tell the user how long to wait.
    const rateLimitHandler = (message) => (req, res) => {
        const { rateLimit: info } = req;
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
    const apiLimiterKeyGenerator = (req) => {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            try {
                const payload = jsonwebtoken_1.default.verify(authHeader.slice(7), app_config_1.config.jwt.secret, {
                    algorithms: ['HS256'],
                });
                if (payload.sub)
                    return `user:${payload.sub}`;
            }
            catch {
                // Invalid/expired token — fall through to IP keying below.
            }
        }
        return `ip:${req.ip}`;
    };
    const apiLimiter = (0, express_rate_limit_1.default)({
        windowMs: app_config_1.config.rateLimit.windowMs,
        max: app_config_1.config.rateLimit.max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: apiLimiterKeyGenerator,
        handler: rateLimitHandler('Too many requests.'),
        // On by default everywhere; only skipped when a developer explicitly opts
        // out (RATE_LIMIT_DISABLED=true) in a non-production env. Never skipped in prod.
        skip: () => app_config_1.config.rateLimit.disabled,
    });
    // Brute-force guard for credential/OTP endpoints. skipSuccessfulRequests means
    // only failed attempts count toward the cap, so a real user logging in (even
    // after the dashboard burns through requests) is never locked out — only
    // repeated wrong passwords / OTP codes are throttled.
    const authLimiter = (0, express_rate_limit_1.default)({
        windowMs: app_config_1.config.rateLimit.windowMs,
        max: app_config_1.config.rateLimit.authMax,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        handler: rateLimitHandler('Too many failed attempts.'),
        skip: () => app_config_1.config.rateLimit.disabled,
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
    // API docs publish the full route/schema surface — do not expose them to
    // anonymous callers in production. Served only outside production.
    if (!app_config_1.config.app.isProd) {
        const openApiDocument = (0, openapi_util_1.buildOpenApiDocument)();
        app.get('/docs.json', (_req, res) => {
            res.status(200).json(openApiDocument);
        });
        app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openApiDocument, {
            customSiteTitle: `${app_config_1.config.app.name} — API Docs`,
            swaggerOptions: { persistAuthorization: true },
        }));
    }
    // Strict limiter on credential/OTP surfaces (before the general limiter so the
    // tighter cap applies there); general limiter for everything else.
    app.use(`${apiPrefix}/auth/login`, authLimiter);
    app.use(`${apiPrefix}/auth/2fa`, authLimiter);
    app.use(`${apiPrefix}/auth/reset-password`, authLimiter);
    app.use(apiPrefix, apiLimiter);
    app.use(apiPrefix, (0, user_1.createUserModule)());
    app.use(apiPrefix, (0, document_1.createDocumentModule)());
    app.use(apiPrefix, (0, asset_1.createAssetModule)());
    app.use(apiPrefix, (0, audit_1.createAuditModule)());
    app.use(apiPrefix, (0, risk_1.createRiskModule)());
    app.use(apiPrefix, (0, workflow_1.createWorkflowModule)());
    app.use(apiPrefix, (0, messaging_1.createMessagingModule)());
    app.use(apiPrefix, (0, logging_1.createLoggingModule)());
    app.use(apiPrefix, (0, background_1.createBackgroundModule)());
    app.use(apiPrefix, (0, dashboard_1.createDashboardModule)());
    app.use(apiPrefix, (0, settings_1.createSettingsModule)());
    app.use(apiPrefix, (0, integration_1.createIntegrationModule)());
    app.use(error_handler_middleware_1.notFoundMiddleware);
    app.use(error_handler_middleware_1.errorHandlerMiddleware);
    return app;
};
const startServer = async () => {
    await (0, storage_client_1.verifyStorageReady)();
    await (0, prisma_client_1.connectDatabase)();
    await cache_client_1.cache.connect();
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
    if (app_config_1.config.rateLimit.disabled) {
        logger_util_1.logger.warn('Rate limiting is DISABLED (RATE_LIMIT_DISABLED=true in a non-production env). ' +
            'Brute-force protection is off — never use this configuration in production.');
    }
    (0, background_1.registerAllJobs)();
    await background_1.schedulerService.startAll();
    void (0, workflow_utility_1.warnOnUnresolvableEscalationTargets)();
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
        background_1.schedulerService.stopAll();
        logger_util_1.logger.info('Scheduler stopped');
        await cache_client_1.cache.disconnect();
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