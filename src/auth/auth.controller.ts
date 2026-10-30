import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCookieAuth, ApiForbiddenResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AllowWhenPasswordChangeRequired, AnyAuthenticated, CurrentUser, Public } from './decorators/auth.decorators';
import { AuthUserResponse } from './dto/auth-user.response';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser, RequestMeta } from './interfaces/authenticated-user.interface';
import { SessionCookieService } from './session-cookie.service';

const metaOf = (req: Request): RequestMeta => ({ ip: req.ip, userAgent: req.get('user-agent') });

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly cookies: SessionCookieService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Administrator login (sets an HttpOnly session cookie)' })
  @ApiOkResponse({ type: AuthUserResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password (generic on purpose)' })
  @ApiTooManyRequestsResponse({ description: 'Too many failed attempts' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthUserResponse> {
    const { user, session } = await this.auth.login(dto, metaOf(req));
    this.cookies.set(res, session.token, session.expiresAt);
    return AuthUserResponse.from(user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AnyAuthenticated()
  @AllowWhenPasswordChangeRequired()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke the current session server-side and clear the cookie' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  async logout(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(user, metaOf(req));
    this.cookies.clear(res);
  }

  @Get('me')
  @AnyAuthenticated()
  @AllowWhenPasswordChangeRequired()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Current user (identity comes from the session, never from the request)' })
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
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto, @Req() req: Request): Promise<void> {
    await this.auth.changePassword(user, dto, metaOf(req));
  }
}
