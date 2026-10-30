import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { authConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthProvisioningService } from './auth-provisioning.service';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OriginGuard } from './guards/origin.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { LoginAttemptService } from './login-attempt.service';
import { PasswordService } from './password.service';
import { SessionCookieService } from './session-cookie.service';
import { SessionService } from './session.service';

/** Requires the project's DatabaseModule to provide PrismaService (global or imported). */
@Module({
  imports: [ConfigModule.forFeature(authConfig)],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    SessionCookieService,
    LoginAttemptService,
    PasswordService,
    AuthProvisioningService,
    JwtAuthGuard,
    RolesGuard,
    // Execution order = registration order: Origin (CSRF) -> Auth (session) -> Permissions (authorization)
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [SessionService, PasswordService, AuthProvisioningService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
