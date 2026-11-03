import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../common/mail/mail.service';
import { AuthConfig, authConfig } from './auth.config';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { LoginDto } from './dto/login.dto';
import {
  DisableTwoFactorDto,
  RegenerateRecoveryCodesDto,
  VerifyTwoFactorLoginDto,
} from './dto/two-factor.dto';
import type { AuthenticatedUser, RequestMeta } from './interfaces/authenticated-user.interface';
import { LoginAttemptService } from './login-attempt.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { TwoFactorService } from './two-factor.service';
import { generateSessionToken, hashIp, hashToken } from './utils/token.util';

const GENERIC_LOGIN_ERROR = 'Invalid email or password';

export type LoginResult =
  | {
      requiresTwoFactor: false;
      user: AuthenticatedUser;
      session: { token: string; expiresAt: Date };
    }
  | { requiresTwoFactor: true; twoFactorTicket: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly attempts: LoginAttemptService,
    private readonly twoFactor: TwoFactorService,
    @Inject(authConfig.KEY) private readonly cfg: AuthConfig,
    @Optional() private readonly mail?: MailService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase();
    const ipHash = hashIp(meta.ip, this.cfg.ipHashSalt);

    // Check lock before verifying password to prevent brute forcing
    if (await this.attempts.isLocked(email, ipHash)) {
      await this.audit(null, 'auth.login_blocked', ipHash, { reason: 'too_many_attempts' });
      throw new HttpException(
        'Too many failed attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        isActive: true,
        deletedAt: true,
        twoFactorEnabled: true,
        twoFactorSecretEnc: true,
      },
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

    // 2FA Challenge workflow
    if (user.twoFactorEnabled) {
      if (dto.twoFactorCode) {
        // Direct 2FA verification during login
        const validCode = await this.verifyUser2FaOrRecoveryCode(
          user.id,
          user.twoFactorSecretEnc,
          dto.twoFactorCode,
        );
        if (!validCode) {
          await this.attempts.record(email, ipHash, false);
          await this.audit(user.id, 'auth.login_2fa_failed', ipHash);
          throw new UnauthorizedException('Invalid two-factor code');
        }
      } else {
        // Issue secure pending 2FA ticket; DO NOT create session yet
        const ticket = this.twoFactor.createTwoFactorTicket(user.id, email);
        return { requiresTwoFactor: true, twoFactorTicket: ticket };
      }
    }

    if (user.passwordHash && this.passwords.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.passwords.hash(dto.password) },
      });
    }

    await this.attempts.record(email, ipHash, true);
    const session = await this.sessions.create(user.id, meta);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit(user.id, 'auth.login', ipHash);

    const current = await this.sessions.validate(session.token);
    if (!current) throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    return { requiresTwoFactor: false, user: current, session };
  }

  async verifyTwoFactorLogin(
    dto: VerifyTwoFactorLoginDto,
    meta: RequestMeta,
  ): Promise<{ user: AuthenticatedUser; session: { token: string; expiresAt: Date } }> {
    const payload = this.twoFactor.verifyTwoFactorTicket(dto.twoFactorTicket);
    if (!payload) {
      throw new UnauthorizedException(
        'Two-factor verification ticket has expired or is invalid. Please sign in again.',
      );
    }

    const ipHash = hashIp(meta.ip, this.cfg.ipHashSalt);
    if (await this.attempts.isLocked(payload.email, ipHash)) {
      await this.audit(payload.userId, 'auth.login_blocked', ipHash, {
        reason: 'too_many_attempts',
      });
      throw new HttpException(
        'Too many failed attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        isActive: true,
        deletedAt: true,
        twoFactorEnabled: true,
        twoFactorSecretEnc: true,
      },
    });

    if (!user || !user.isActive || user.deletedAt || !user.twoFactorEnabled) {
      await this.attempts.record(payload.email, ipHash, false);
      throw new UnauthorizedException('Invalid account status or two-factor is not enabled');
    }

    const validCode = await this.verifyUser2FaOrRecoveryCode(
      user.id,
      user.twoFactorSecretEnc,
      dto.code,
    );

    if (!validCode) {
      await this.attempts.record(payload.email, ipHash, false);
      await this.audit(user.id, 'auth.login_2fa_failed', ipHash);
      throw new UnauthorizedException('Invalid two-factor code');
    }

    await this.attempts.record(payload.email, ipHash, true);
    const session = await this.sessions.create(user.id, meta);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit(user.id, 'auth.login_2fa_success', ipHash);

    const current = await this.sessions.validate(session.token);
    if (!current) throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    return { user: current, session };
  }

  async logout(user: AuthenticatedUser, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(user.sessionId);
    await this.audit(user.id, 'auth.logout', hashIp(meta.ip, this.cfg.ipHashSalt));
  }

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<void> {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    const valid =
      !!row?.passwordHash && (await this.passwords.verify(row.passwordHash, dto.currentPassword));
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const problems = this.passwords.validatePolicy(dto.newPassword, { email: user.email });
    if (dto.newPassword === dto.currentPassword)
      problems.push('New password must differ from the current password');
    if (problems.length)
      throw new BadRequestException({ message: 'Password does not meet the policy', problems });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(dto.newPassword), mustChangePassword: false },
    });
    // Sign out every other device; keep the current session.
    await this.sessions.revokeAllForUser(user.id, user.sessionId);
    await this.audit(user.id, 'auth.password_changed', hashIp(meta.ip, this.cfg.ipHashSalt));
  }

  async requestPasswordReset(
    dto: ForgotPasswordDto,
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const genericResponse = {
      message: 'If an account exists with that email, a password reset link has been sent.',
    };
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, isActive: true, deletedAt: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return genericResponse;
    }

    const rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    try {
      await this.prisma.$transaction([
        this.prisma.passwordReset.deleteMany({
          where: { userId: user.id },
        }),
        this.prisma.passwordReset.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        }),
      ]);
    } catch (err) {
      this.logger.error(`Failed to store password reset token: ${(err as Error).message}`);
      return genericResponse;
    }

    if (this.mail) {
      await this.mail.sendPasswordResetEmail(user.email, rawToken, user.name);
    }
    await this.audit(
      user.id,
      'auth.password_reset_requested',
      hashIp(meta.ip, this.cfg.ipHashSalt),
    );

    return genericResponse;
  }

  async resetPasswordWithToken(
    dto: ResetPasswordDto,
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const tokenHash = hashToken(dto.token);
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const problems = this.passwords.validatePolicy(dto.newPassword, { email: reset.user.email });
    if (problems.length) {
      throw new BadRequestException({ message: 'Password does not meet the policy', problems });
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Invalidate every active session for this user
    await this.sessions.revokeAllForUser(reset.userId);
    await this.audit(
      reset.userId,
      'auth.password_reset_completed',
      hashIp(meta.ip, this.cfg.ipHashSalt),
    );

    return { message: 'Password has been reset successfully. You can now log in.' };
  }

  // --- Two-Factor Management (Self-Service) ---

  async getTwoFactorStatus(user: AuthenticatedUser): Promise<{ enabled: boolean }> {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    });
    return { enabled: row?.twoFactorEnabled ?? false };
  }

  async generateTwoFactorSecret(user: AuthenticatedUser): Promise<{ secret: string; uri: string }> {
    const { secret, uri } = this.twoFactor.generateSecret(user.email);
    const enc = this.twoFactor.encryptSecret(secret);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecretEnc: enc },
    });
    return { secret, uri };
  }

  async enableTwoFactor(
    user: AuthenticatedUser,
    code: string,
    meta: RequestMeta,
  ): Promise<{ recoveryCodes: string[] }> {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorSecretEnc: true },
    });
    if (!row?.twoFactorSecretEnc) {
      throw new BadRequestException(
        'Two-factor secret has not been generated. Please generate secret first.',
      );
    }

    const secret = this.twoFactor.decryptSecret(row.twoFactorSecretEnc);
    if (!this.twoFactor.verifyTotp(secret, code)) {
      throw new BadRequestException(
        'Invalid verification code. Please check your authenticator clock.',
      );
    }

    const { rawCodes, hashedCodes } = this.twoFactor.generateRecoveryCodes(8);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
      });
      await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.recoveryCode.createMany({
        data: hashedCodes.map((codeHash) => ({ userId: user.id, codeHash })),
      });
    });

    await this.audit(user.id, 'auth.2fa_enabled', hashIp(meta.ip, this.cfg.ipHashSalt));
    return { recoveryCodes: rawCodes };
  }

  async disableTwoFactor(
    user: AuthenticatedUser,
    dto: DisableTwoFactorDto,
    meta: RequestMeta,
  ): Promise<void> {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, twoFactorSecretEnc: true },
    });
    const valid =
      !!row?.passwordHash && (await this.passwords.verify(row.passwordHash, dto.password));
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    if (dto.code && row.twoFactorSecretEnc) {
      const secret = this.twoFactor.decryptSecret(row.twoFactorSecretEnc);
      if (!this.twoFactor.verifyTotp(secret, dto.code)) {
        throw new BadRequestException('Invalid two-factor code');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: false, twoFactorSecretEnc: null },
      });
      await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
    });

    await this.audit(user.id, 'auth.2fa_disabled', hashIp(meta.ip, this.cfg.ipHashSalt));
  }

  async regenerateRecoveryCodes(
    user: AuthenticatedUser,
    dto: RegenerateRecoveryCodesDto,
    meta: RequestMeta,
  ): Promise<{ recoveryCodes: string[] }> {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, twoFactorEnabled: true },
    });
    const valid =
      !!row?.passwordHash && (await this.passwords.verify(row.passwordHash, dto.password));
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    if (!row?.twoFactorEnabled)
      throw new BadRequestException('Two-factor authentication is not active');

    const { rawCodes, hashedCodes } = this.twoFactor.generateRecoveryCodes(8);

    await this.prisma.$transaction(async (tx) => {
      await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.recoveryCode.createMany({
        data: hashedCodes.map((codeHash) => ({ userId: user.id, codeHash })),
      });
    });

    await this.audit(
      user.id,
      'auth.2fa_recovery_codes_regenerated',
      hashIp(meta.ip, this.cfg.ipHashSalt),
    );
    return { recoveryCodes: rawCodes };
  }

  // --- Internal Helpers ---

  private async verifyUser2FaOrRecoveryCode(
    userId: string,
    secretEnc: string | null,
    code: string,
  ): Promise<boolean> {
    const cleanCode = code.trim();

    // Check TOTP if secret is present
    if (secretEnc) {
      try {
        const secret = this.twoFactor.decryptSecret(secretEnc);
        if (this.twoFactor.verifyTotp(secret, cleanCode)) {
          return true;
        }
      } catch (err) {
        this.logger.error(
          `Error decrypting TOTP secret for user ${userId}: ${(err as Error).message}`,
        );
      }
    }

    // Check one-time backup recovery codes
    const codeHash = this.twoFactor.hashRecoveryCode(cleanCode);
    const rec = await this.prisma.recoveryCode.findFirst({
      where: { userId, codeHash, usedAt: null },
    });

    if (rec) {
      // Mark code as used immediately (single-use protection)
      await this.prisma.recoveryCode.update({
        where: { id: rec.id },
        data: { usedAt: new Date() },
      });
      return true;
    }

    return false;
  }

  /** Audit failures must never break authentication, but must be visible in logs. */
  private async audit(
    actorId: string | null,
    action: string,
    ipHash?: string,
    diff?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action,
          entityType: actorId ? 'user' : null,
          entityId: actorId,
          ipHash,
          diff: diff as never,
        },
      });
    } catch (err) {
      this.logger.error(`Audit log write failed for ${action}: ${(err as Error).message}`);
    }
  }
}
