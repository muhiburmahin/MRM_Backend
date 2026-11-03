import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  AllowWhenPasswordChangeRequired,
  AnyAuthenticated,
  CurrentUser,
  Public,
} from './decorators/auth.decorators';
import { AuthUserResponse } from './dto/auth-user.response';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { LoginDto } from './dto/login.dto';
import {
  DisableTwoFactorDto,
  EnableTwoFactorDto,
  RegenerateRecoveryCodesDto,
  TwoFactorEnableResponse,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse,
  VerifyTwoFactorLoginDto,
} from './dto/two-factor.dto';
import type { AuthenticatedUser, RequestMeta } from './interfaces/authenticated-user.interface';
import { SessionCookieService } from './session-cookie.service';

const metaOf = (req: Request): RequestMeta => ({ ip: req.ip, userAgent: req.get('user-agent') });

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: SessionCookieService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Administrator login (sets an HttpOnly session cookie on full auth)' })
  @ApiOkResponse({ type: AuthUserResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password (generic on purpose)' })
  @ApiTooManyRequestsResponse({ description: 'Too many failed attempts' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponse | { requiresTwoFactor: true; twoFactorTicket: string }> {
    const result = await this.auth.login(dto, metaOf(req));
    if (result.requiresTwoFactor) {
      return { requiresTwoFactor: true, twoFactorTicket: result.twoFactorTicket };
    }
    this.cookies.set(res, result.session.token, result.session.expiresAt);
    return AuthUserResponse.from(result.user);
  }

  @Public()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify pending 2FA login ticket (sets an HttpOnly session cookie on success)',
  })
  @ApiOkResponse({ type: AuthUserResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired 2FA code / ticket' })
  async verifyTwoFactorLogin(
    @Body() dto: VerifyTwoFactorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponse> {
    const { user, session } = await this.auth.verifyTwoFactorLogin(dto, metaOf(req));
    this.cookies.set(res, session.token, session.expiresAt);
    return AuthUserResponse.from(user);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset link by email (public)' })
  @ApiOkResponse({ description: 'Generic success response regardless of account existence' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.auth.requestPasswordReset(dto, metaOf(req));
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset account password using valid reset token (public)' })
  @ApiOkResponse({ description: 'Password reset successful' })
  @ApiBadRequestResponse({ description: 'Invalid or expired token, or weak password' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.auth.resetPasswordWithToken(dto, metaOf(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AnyAuthenticated()
  @AllowWhenPasswordChangeRequired()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke the current session server-side and clear the cookie' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(user, metaOf(req));
    this.cookies.clear(res);
  }

  @Get('me')
  @AnyAuthenticated()
  @AllowWhenPasswordChangeRequired()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Current user (identity comes from the session, never from the request)',
  })
  @ApiOkResponse({ type: AuthUserResponse })
  @ApiUnauthorizedResponse()
  me(@CurrentUser() user: AuthenticatedUser): AuthUserResponse {
    return AuthUserResponse.from(user);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AnyAuthenticated()
  @AllowWhenPasswordChangeRequired()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Change own password; all other sessions are revoked' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'New password violates the policy' })
  @ApiUnauthorizedResponse({ description: 'Not signed in, or current password is wrong' })
  @ApiForbiddenResponse()
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.changePassword(user, dto, metaOf(req));
  }

  // --- Two-Factor Management Endpoints ---

  @Get('2fa/status')
  @AnyAuthenticated()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Check whether 2FA is active for the current user' })
  @ApiOkResponse({ type: TwoFactorStatusResponse })
  async getTwoFactorStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorStatusResponse> {
    return this.auth.getTwoFactorStatus(user);
  }

  @Post('2fa/generate')
  @HttpCode(HttpStatus.OK)
  @AnyAuthenticated()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Generate a new TOTP secret and provisioning URI for setup' })
  @ApiOkResponse({ type: TwoFactorSetupResponse })
  async generateTwoFactorSecret(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorSetupResponse> {
    return this.auth.generateTwoFactorSecret(user);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @AnyAuthenticated()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Confirm TOTP setup with code and activate 2FA (returns one-time recovery codes)',
  })
  @ApiOkResponse({ type: TwoFactorEnableResponse })
  async enableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnableTwoFactorDto,
    @Req() req: Request,
  ): Promise<TwoFactorEnableResponse> {
    return this.auth.enableTwoFactor(user, dto.code, metaOf(req));
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AnyAuthenticated()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Disable 2FA after password confirmation' })
  @ApiNoContentResponse()
  async disableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisableTwoFactorDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.disableTwoFactor(user, dto, metaOf(req));
  }

  @Post('2fa/recovery-codes')
  @HttpCode(HttpStatus.OK)
  @AnyAuthenticated()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Regenerate one-time backup recovery codes' })
  @ApiOkResponse({ type: TwoFactorEnableResponse })
  async regenerateRecoveryCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegenerateRecoveryCodesDto,
    @Req() req: Request,
  ): Promise<TwoFactorEnableResponse> {
    return this.auth.regenerateRecoveryCodes(user, dto, metaOf(req));
  }
}
