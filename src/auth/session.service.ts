import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthConfig, authConfig } from './auth.config';
import type { AuthenticatedUser, RequestMeta } from './interfaces/authenticated-user.interface';
import { generateSessionToken, hashIp, hashToken } from './utils/token.util';

interface PermissionRow { permission: { key: string } }

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(authConfig.KEY) private readonly cfg: AuthConfig,
  ) {}

  async create(userId: string, meta: RequestMeta): Promise<{ token: string; expiresAt: Date }> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + this.cfg.sessionTtlHours * 3_600_000);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        ipHash: hashIp(meta.ip, this.cfg.ipHashSalt),
        userAgent: meta.userAgent?.slice(0, 255),
        expiresAt,
      },
    });
    return { token, expiresAt };
  }

  /** Returns the current user for a valid session, otherwise null. Never throws for bad tokens. */
  async validate(token: string): Promise<AuthenticatedUser | null> {
    if (!token || token.length > 256) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
    const user = session.user;
    if (!user || !user.isActive || user.deletedAt) return null;

    return {
      id: user.id,
      sessionId: session.id,
      email: user.email,
      name: user.name,
      uiLocale: user.uiLocale,
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled: user.twoFactorEnabled,
      role: { id: user.role.id, key: user.role.key, name: user.role.name },
      permissions: (user.role.permissions as PermissionRow[]).map((p) => p.permission.key),
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  /** For a future scheduled job. */
  async purgeExpired(): Promise<number> {
    const res = await this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
    return res.count;
  }
}
