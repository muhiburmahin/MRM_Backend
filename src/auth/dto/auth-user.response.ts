import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

class RoleSummary {
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
}

/** Safe profile with optional session tokens for API / Bearer authentication. */
export class AuthUserResponse {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty() uiLocale!: string;
  @ApiProperty({ type: RoleSummary }) role!: RoleSummary;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({
    description: 'If true, only /auth/me, /auth/logout and /auth/change-password are allowed.',
  })
  mustChangePassword!: boolean;

  @ApiPropertyOptional({ description: 'Bearer session access token' })
  accessToken?: string;

  @ApiPropertyOptional({ description: 'Bearer session access token alias' })
  token?: string;

  @ApiPropertyOptional({ description: 'Session expiration in ISO format' })
  expiresAt?: string;

  static from(u: AuthenticatedUser): AuthUserResponse {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      uiLocale: u.uiLocale,
      role: { key: u.role.key, name: u.role.name },
      permissions: [...u.permissions],
      mustChangePassword: u.mustChangePassword,
    };
  }
}
