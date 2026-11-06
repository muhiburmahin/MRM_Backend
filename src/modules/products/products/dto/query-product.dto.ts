import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const PRODUCT_SORT_FIELDS = [
  'createdAt',
  'sortOrder',
  'displayOrder',
  'homepageOrder',
  'navOrder',
  'featuredOrder',
  'title',
] as const;

export const PRODUCT_PLACEMENTS = ['homepage', 'nav', 'catalog', 'all'] as const;

export class QueryProductDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Searches name and description' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale: string = 'en';

  @ApiPropertyOptional({ enum: PRODUCT_SORT_FIELDS, default: 'displayOrder' })
  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS)
  sortBy: (typeof PRODUCT_SORT_FIELDS)[number] = 'displayOrder';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({ enum: PRODUCT_PLACEMENTS, description: 'Filter by placement context' })
  @IsOptional()
  @IsIn(PRODUCT_PLACEMENTS)
  placement?: (typeof PRODUCT_PLACEMENTS)[number];

  @ApiPropertyOptional({ description: 'Category slug or ID' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Preview unpublished drafts (admin preview)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  preview?: boolean;
}

/** Admin-only extra filter. Public queries use QueryProductDto, so isPublished cannot be overridden there. */
export class AdminQueryProductDto extends QueryProductDto {
  @ApiPropertyOptional({ description: 'Filter by publication state' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'Filter by status: DRAFT, PUBLISHED, ARCHIVED, etc.' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by stage: LIVE, BETA, COMING_SOON, etc.' })
  @IsOptional()
  @IsString()
  stage?: string;
}
