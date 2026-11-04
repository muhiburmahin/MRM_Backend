import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  return value;
};

const trimEmail = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    return trimmed === '' ? null : trimmed;
  }
  return value;
};

const URL_OPTS = { protocols: ['http', 'https'], require_protocol: true };

/**
 * Single DTO for create-or-update of the one global company profile.
 * Every field is optional, except `name` is required the first time the profile is created.
 * Sending `null` for an optional field clears it. id/updatedAt are never accepted.
 * Requires ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }).
 */
export class UpdateCompanyDto {
  @ApiPropertyOptional({ description: 'Public visibility; required when creating the profile' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  // Not nullable: `name: null` is rejected.
  @ApiPropertyOptional({ example: 'MRM Infotech' })
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  name?: string;

  @ApiPropertyOptional({ nullable: true, example: 'MRM InfoTech Ltd.' })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(200)
  legalName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Technology that grows your business' })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(200)
  tagline?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '/uploads/3f2c...png',
    description: 'Relative /uploads path or http(s) URL',
  })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  @Matches(/^(\/uploads\/[\w.-]+|https?:\/\/\S+)$/, {
    message: 'logoUrl must be an /uploads path or an http(s) URL',
  })
  logoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'info@example.com' })
  @IsOptional()
  @Transform(trimEmail)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'support@example.com' })
  @IsOptional()
  @Transform(trimEmail)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsEmail()
  @MaxLength(254)
  supportEmail?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '+8801700000000' })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @Matches(/^\+?[0-9\s\-()]{6,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '+8801700000000' })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @Matches(/^\+?[0-9\s\-()]{6,20}$/, { message: 'whatsapp must be a valid phone number' })
  whatsapp?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(300)
  headquarters?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://example.com' })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  website?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  facebookUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  linkedinUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  twitterUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  instagramUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  githubUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  youtubeUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '© 2026 MRM InfoTech Ltd. All rights reserved.' })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(300)
  copyrightText?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 2015 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1800)
  @Max(2100)
  foundedYear?: number | null;
}
