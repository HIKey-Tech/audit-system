// src/shared/prisma/prisma.client.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.util';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient => {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e) => {
      logger.debug('Prisma Query', { query: e.query, duration: e.duration },);
    });
  }

  client.$on('error', (e) => {
    logger.error('Prisma Error', { message: e.message });
  });

  client.$on('warn', (e) => {
    logger.warn('Prisma Warning', { message: e.message });
  });

  return client;
};

// Singleton pattern — reuse client in dev (hot reload safety)
export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  logger.info('Database connected successfully');
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('Database disconnected');
};