import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ContentStatus } from '@prisma/client';
import {
  IsBoolean,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const STATUSES = Object.values(ContentStatus);

export class CreatePageTranslationDto {
  @ApiProperty({ example: 'en', maxLength: 10 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MaxLength(10)
  locale!: string;

  @ApiProperty({ example: '/about-us', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  path!: string;

  @ApiProperty({ example: 'About MRM Infotech', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    type: 'array',
    example: [{ id: 'hero-main', type: 'hero', data: { heading: 'About us' } }],
  })
  @IsArray()
  blocks!: unknown[];

  @ApiPropertyOptional({ enum: ContentStatus, default: ContentStatus.DRAFT })
  @IsOptional()
  @IsIn(STATUSES)
  status?: ContentStatus;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;

  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  canonicalUrl?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ogImageId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  jsonLd?: Record<string, unknown>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;
}

export { STATUSES as PAGE_CONTENT_STATUSES };
