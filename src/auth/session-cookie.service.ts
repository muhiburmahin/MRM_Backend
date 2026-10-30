import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AuthConfig, authConfig } from './auth.config';

@Injectable()
export class SessionCookieService {
  constructor(@Inject(authConfig.KEY) private readonly cfg: AuthConfig) {}

  private base(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cfg.cookieSecure,
      sameSite: this.cfg.cookieSameSite,
      domain: this.cfg.cookieDomain,
      path: '/',
    };
  }

  set(res: Response, token: string, expiresAt: Date): void {
    res.cookie(this.cfg.cookieName, token, { ...this.base(), expires: expiresAt });
  }

  clear(res: Response): void {
    res.clearCookie(this.cfg.cookieName, this.base());
  }
}
