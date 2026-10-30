import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDate, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const LAUNCH_STAGES = ['LIVE', 'BETA', 'PLANNED'] as const;
const CONTENT_STATUSES = ['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;

export class ProductTranslationDto {
  @ApiProperty({ example: 'en' })
  @IsString()
  @Length(2, 10)
  locale: string;

  @ApiProperty()
  @IsString()
  @Length(1, 150)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  tagline: string;

  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  summary: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: CONTENT_STATUSES, default: 'DRAFT' })
  @IsOptional()
  @IsIn(CONTENT_STATUSES)
  status?: (typeof CONTENT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ogImageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;
}

/** The slug is the product's shared URL identifier; publication belongs to each translation. */
export class CreateProductDto {
  @ApiProperty({ example: 'edumanage-bd' })
  @IsString()
  @Length(2, 150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @ApiPropertyOptional({ enum: LAUNCH_STAGES, default: 'LIVE' })
  @IsOptional()
  @IsIn(LAUNCH_STAGES)
  stage?: (typeof LAUNCH_STAGES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  logoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  heroImageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  brandColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  productSiteUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  demoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  privacyUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  termsUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  launchedAt?: Date;

  @ApiProperty({ type: [ProductTranslationDto], minItems: 1 })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductTranslationDto)
  translations: ProductTranslationDto[];
}
