import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../database/prisma.service';

const DB_CHECK_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(HealthService.name);
  }

  /** Resolves true when PostgreSQL answers a trivial query within the timeout. */
  async isDatabaseUp(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('database check timed out')),
          DB_CHECK_TIMEOUT_MS,
        );
      });
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      return true;
    } catch (err) {
      this.logger.warn(
        { errorType: err instanceof Error ? err.name : typeof err },
        'Database readiness check failed',
      );
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
