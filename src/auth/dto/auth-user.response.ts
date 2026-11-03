import { ApiProperty } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

class RoleSummary {
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
}

/** Safe profile: no hashes, no tokens, no internal security fields. */
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
