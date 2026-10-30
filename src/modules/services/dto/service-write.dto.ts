import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
  ValidateNested,
} from 'class-validator';
import { LOCALE_RE, SLUG_RE, WRITABLE_STATUSES, WritableStatus } from '../services.constants';
import { MaxJsonSize, Trim } from './validators';

const BODY_MAX_CHARS = 100_000;

/** Fields shared by create (required ones) and update (all optional) translation payloads. */
export class CreateServiceTranslationDto {
  @ApiProperty({ example: 'en' }) @Matches(LOCALE_RE)
  locale!: string;

  @ApiProperty({ maxLength: 120 }) @Trim() @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @ApiProperty({ maxLength: 500 }) @Trim() @IsString() @MinLength(1) @MaxLength(500)
  summary!: string;

  @ApiPropertyOptional({ description: 'Free-form JSON content (max ~100k chars). Frontend must render it safely.' })
  @IsOptional() @IsObject() @MaxJsonSize(BODY_MAX_CHARS)
  body?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: WRITABLE_STATUSES, default: 'DRAFT' })
  @IsOptional() @IsIn(WRITABLE_STATUSES)
  status?: WritableStatus;

  @ApiPropertyOptional({ maxLength: 70, nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(70)
  seoTitle?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(200)
  seoDescription?: string | null;
}

export class CreateServiceDto {
  @ApiProperty({ example: 'web-development', description: 'Lowercase ASCII letters, digits and hyphens' })
  @Trim() @Matches(SLUG_RE) @MaxLength(80)
  slug!: string;

  @ApiPropertyOptional({ maxLength: 60, nullable: true, description: 'Icon name (not a media upload)' })
  @IsOptional() @Trim() @IsString() @MaxLength(60)
  icon?: string | null;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) @Max(100_000)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [CreateServiceTranslationDto], description: 'At least one translation; one per locale' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => CreateServiceTranslationDto)
  translations!: CreateServiceTranslationDto[];
}

/** Upsert by locale: `name` and `summary` are required only when the locale does not exist yet. */
export class UpsertServiceTranslationDto {
  @ApiProperty({ example: 'bn' }) @Matches(LOCALE_RE)
  locale!: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MinLength(1) @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional() @IsOptional() @IsObject() @MaxJsonSize(BODY_MAX_CHARS)
  body?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: WRITABLE_STATUSES }) @IsOptional() @IsIn(WRITABLE_STATUSES)
  status?: WritableStatus;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(70)
  seoTitle?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(200)
  seoDescription?: string | null;
}

export class UpdateServiceDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @Matches(SLUG_RE) @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(60)
  icon?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100_000)
  sortOrder?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [UpsertServiceTranslationDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => UpsertServiceTranslationDto)
  translations?: UpsertServiceTranslationDto[];
}
