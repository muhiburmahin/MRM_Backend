import { Injectable } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

/**
 * Compatibility wrapper for code that expects a JWT-style auth guard name.
 * The project uses signed, server-side session cookies rather than bearer JWTs.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard {}
