import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../database/prisma.service';

const DB_CHECK_TIMEOUT_MS = 2000;

export interface DatabaseCheckResult {
  isUp: boolean;
  latencyMs?: number;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(HealthService.name);
  }

  /** Check database connectivity and measure query latency safely without exposing credentials. */
  async checkDatabase(): Promise<DatabaseCheckResult> {
    let timer: NodeJS.Timeout | undefined;
    const start = process.hrtime.bigint();
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('database check timed out')),
          DB_CHECK_TIMEOUT_MS,
        );
      });
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      return { isUp: true, latencyMs: Math.round(latencyMs * 10) / 10 };
    } catch (err) {
      this.logger.warn(
        { errorType: err instanceof Error ? err.name : typeof err },
        'Database readiness check failed',
      );
      return { isUp: false };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Resolves true when PostgreSQL answers a trivial query within the timeout. */
  async isDatabaseUp(): Promise<boolean> {
    const result = await this.checkDatabase();
    return result.isUp;
  }
}
