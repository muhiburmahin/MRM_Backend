import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthConfig, authConfig } from './auth.config';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser, RequestMeta } from './interfaces/authenticated-user.interface';
import { LoginAttemptService } from './login-attempt.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { hashIp } from './utils/token.util';

const GENERIC_LOGIN_ERROR = 'Invalid email or password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly attempts: LoginAttemptService,
    @Inject(authConfig.KEY) private readonly cfg: AuthConfig,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const ipHash = hashIp(meta.ip, this.cfg.ipHashSalt);

    // Check the lock BEFORE verifying the password so a locked account can't be guessed further.
    if (await this.attempts.isLocked(email, ipHash)) {
      await this.audit(null, 'auth.login_blocked', ipHash, { reason: 'too_many_attempts' });
      throw new HttpException('Too many failed attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, isActive: true, deletedAt: true, twoFactorEnabled: true },
    });

    let ok = false;
    if (user?.passwordHash) {
      ok = await this.passwords.verify(user.passwordHash, dto.password);
    } else {
      await this.passwords.verifyDummy(dto.password);
    }

    const allowed = ok && !!user && user.isActive && !user.deletedAt;
    if (!allowed || !user) {
      await this.attempts.record(email, ipHash, false);
      await this.audit(user?.id ?? null, 'auth.login_failed', ipHash);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    // Fail closed: 2FA verification is NOT implemented yet, so such accounts cannot sign in.
    if (user.twoFactorEnabled) {
      this.logger.warn(`Login refused for user ${user.id}: 2FA is enabled but not yet supported by this module`);
      await this.attempts.record(email, ipHash, false);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    if (user.passwordHash && this.passwords.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.passwords.hash(dto.password) } });
    }

    await this.attempts.record(email, ipHash, true);
    const session = await this.sessions.create(user.id, meta);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit(user.id, 'auth.login', ipHash);

    const current = await this.sessions.validate(session.token);
    if (!current) throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    return { user: current, session };
  }

  async logout(user: AuthenticatedUser, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(user.sessionId);
    await this.audit(user.id, 'auth.logout', hashIp(meta.ip, this.cfg.ipHashSalt));
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto, meta: RequestMeta): Promise<void> {
    const row = await this.prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    const valid = !!row?.passwordHash && (await this.passwords.verify(row.passwordHash, dto.currentPassword));
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const problems = this.passwords.validatePolicy(dto.newPassword, { email: user.email });
    if (dto.newPassword === dto.currentPassword) problems.push('New password must differ from the current password');
    if (problems.length) throw new BadRequestException({ message: 'Password does not meet the policy', problems });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(dto.newPassword), mustChangePassword: false },
    });
    // Sign out every other device; keep the current session.
    await this.sessions.revokeAllForUser(user.id, user.sessionId);
    await this.audit(user.id, 'auth.password_changed', hashIp(meta.ip, this.cfg.ipHashSalt));
  }

  /** Audit failures must never break authentication, but must be visible in logs. */
  private async audit(actorId: string | null, action: string, ipHash?: string, diff?: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { actorId, action, entityType: actorId ? 'user' : null, entityId: actorId, ipHash, diff: diff as never },
      });
    } catch (err) {
      this.logger.error(`Audit log write failed for ${action}: ${(err as Error).message}`);
    }
  }
}
