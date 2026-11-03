import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * The single Prisma client for the whole application.
 * Feature modules inject PrismaService; they never call `new PrismaClient()`.
 * The connection string comes from DATABASE_URL (validated at startup).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect(); // fail fast: the app should not start without its database
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Execute an atomic callback within a managed transaction.
   * Sensible defaults: maxWait: 5000ms, timeout: 10000ms.
   */
  async executeInTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    return this.$transaction(async (tx) => fn(tx), {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
      isolationLevel: options?.isolationLevel,
    });
  }
}
