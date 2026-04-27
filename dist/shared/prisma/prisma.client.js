"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDatabase = exports.connectDatabase = exports.prisma = void 0;
// src/shared/prisma/prisma.client.ts
const client_1 = require("@prisma/client");
const logger_util_1 = require("../utils/logger.util");
const createPrismaClient = () => {
    const client = new client_1.PrismaClient({
        log: [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
        ],
    });
    if (process.env.NODE_ENV === 'development') {
        client.$on('query', (e) => {
            logger_util_1.logger.debug('Prisma Query', { query: e.query, duration: e.duration });
        });
    }
    client.$on('error', (e) => {
        logger_util_1.logger.error('Prisma Error', { message: e.message });
    });
    client.$on('warn', (e) => {
        logger_util_1.logger.warn('Prisma Warning', { message: e.message });
    });
    return client;
};
// Singleton pattern — reuse client in dev (hot reload safety)
exports.prisma = global.__prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
    global.__prisma = exports.prisma;
}
const connectDatabase = async () => {
    await exports.prisma.$connect();
    logger_util_1.logger.info('Database connected successfully');
};
exports.connectDatabase = connectDatabase;
const disconnectDatabase = async () => {
    await exports.prisma.$disconnect();
    logger_util_1.logger.info('Database disconnected');
};
exports.disconnectDatabase = disconnectDatabase;
//# sourceMappingURL=prisma.client.js.map