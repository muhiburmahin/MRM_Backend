import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthConfig, authConfig } from './auth.config';

@Injectable()
export class LoginAttemptService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(authConfig.KEY) private readonly cfg: AuthConfig,
  ) {}

  private windowStart(): Date {
    return new Date(Date.now() - this.cfg.lockoutMinutes * 60_000);
  }

  /**
   * Locked when recent failures (since the last success) for this email reach the limit,
   * or the IP bucket has 5x the per-account limit. Counted regardless of whether the account exists,
   * so the response never reveals account existence.
   */
  async isLocked(email: string, ipHash?: string): Promise<boolean> {
    const since = this.windowStart();
    const lastSuccess = await this.prisma.loginAttempt.findFirst({
      where: { email, success: true, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const from: Date = lastSuccess && lastSuccess.createdAt > since ? lastSuccess.createdAt : since;

    const [byEmail, byIp] = await Promise.all([
      this.prisma.loginAttempt.count({ where: { email, success: false, createdAt: { gte: from } } }),
      ipHash
        ? this.prisma.loginAttempt.count({ where: { ipHash, success: false, createdAt: { gte: since } } })
        : Promise.resolve(0),
    ]);
    return byEmail >= this.cfg.maxFailedAttempts || byIp >= this.cfg.maxFailedAttempts * 5;
  }

  async record(email: string, ipHash: string | undefined, success: boolean): Promise<void> {
    await this.prisma.loginAttempt.create({ data: { email, ipHash: ipHash ?? 'unknown', success } });
  }
}
