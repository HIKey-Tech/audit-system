"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
// src/shared/utils/logger.util.ts
const winston_1 = __importDefault(require("winston"));
const app_config_1 = require("../config/app.config");
const { combine, timestamp, printf, colorize, json, errors } = winston_1.default.format;
const devFormat = combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${stack || message}${metaStr}`;
}));
const prodFormat = combine(timestamp(), errors({ stack: true }), json());
exports.logger = winston_1.default.createLogger({
    level: app_config_1.config.logging.level,
    format: app_config_1.config.app.isDev ? devFormat : prodFormat,
    defaultMeta: { service: app_config_1.config.app.name },
    transports: [
        new winston_1.default.transports.Console(),
        ...(app_config_1.config.app.isProd
            ? [
                new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
            ]
            : []),
    ],
});
//# sourceMappingURL=logger.util.js.map