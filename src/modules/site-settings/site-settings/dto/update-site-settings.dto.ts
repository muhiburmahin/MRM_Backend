import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Matches the key/group/value/isPublic contract of the SiteSetting Prisma model. */
export class UpdateSiteSettingsDto {
  @ApiPropertyOptional({ example: 'company.profile', maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/)
  key?: string;

  @ApiPropertyOptional({ example: 'company', maxLength: 80, default: 'general' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  group?: string;

  @ApiProperty({ description: 'JSON value stored for this setting' })
  @IsDefined()
  @Allow()
  value: unknown;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
