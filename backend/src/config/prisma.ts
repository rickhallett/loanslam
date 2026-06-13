import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '@prisma/client';

import { env } from './env.js';
import { logger } from './logger.js';

let prismaClient: PrismaClient | undefined;

export function createPrismaClient(
  databaseUrl: string | undefined = env.DATABASE_URL,
): PrismaClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create a Prisma client');
  }

  const adapter = new PrismaMssql(databaseUrl, {
    onConnectionError: (error) => {
      logger.error({ error }, 'Prisma SQL Server connection error');
    },
    onPoolError: (error) => {
      logger.error({ error }, 'Prisma SQL Server pool error');
    },
  });

  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  prismaClient ??= createPrismaClient();
  return prismaClient;
}

export async function disconnectPrisma(): Promise<void> {
  if (!prismaClient) {
    return;
  }

  await prismaClient.$disconnect();
  prismaClient = undefined;
}
