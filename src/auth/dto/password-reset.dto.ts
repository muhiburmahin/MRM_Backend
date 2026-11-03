import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@mrminfotech.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: '4f8e...opaqueToken' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token!: string;

  @ApiProperty({
    format: 'password',
    example: 'NewSecureP@ssw0rd!2026',
    description: 'Min 12 characters. Full policy enforced server-side.',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

