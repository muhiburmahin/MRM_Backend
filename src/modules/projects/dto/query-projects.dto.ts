import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ADMIN_SORT_FIELDS,
  LOCALE_RE,
  PUBLIC_SORT_FIELDS,
  SLUG_RE,
  SortOrder,
  WRITABLE_STATUSES,
  WritableStatus,
} from '../projects.constants';
import { ToBoolean, Trim } from './validators';

export class ProjectLocaleQueryDto {
  @ApiPropertyOptional({
    example: 'en',
    description: 'Defaults to the default language in the Language table',
  })
  @IsOptional()
  @Matches(LOCALE_RE)
  locale?: string;
}

export class ProjectSlugParamDto {
  @Matches(SLUG_RE)
  @MaxLength(80)
  slug!: string;
}

export class QueryProjectsDto extends ProjectLocaleQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page: number = 1;

  @ApiPropertyOptional({ default: 9, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 9;

  @ApiPropertyOptional({ enum: PUBLIC_SORT_FIELDS, default: 'sortOrder' })
  @IsOptional()
  @IsIn(PUBLIC_SORT_FIELDS)
  sort: (typeof PUBLIC_SORT_FIELDS)[number] = 'sortOrder';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: SortOrder = 'asc';

  @ApiPropertyOptional({ description: 'Search in title and summary' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Service slug' })
  @IsOptional()
  @Matches(SLUG_RE)
  @MaxLength(80)
  service?: string;

  @ApiPropertyOptional({ description: 'Industry slug' })
  @IsOptional()
  @Matches(SLUG_RE)
  @MaxLength(80)
  industry?: string;

  @ApiPropertyOptional({ description: 'Product slug' })
  @IsOptional()
  @Matches(SLUG_RE)
  @MaxLength(80)
  product?: string;
}

export class AdminQueryProjectsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: ADMIN_SORT_FIELDS, default: 'sortOrder' })
  @IsOptional()
  @IsIn(ADMIN_SORT_FIELDS)
  sort: (typeof ADMIN_SORT_FIELDS)[number] = 'sortOrder';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: SortOrder = 'asc';

  @ApiPropertyOptional({ description: 'Search in slug and titles' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsIn([true, false])
  isVerified?: boolean;

  @ApiPropertyOptional({ enum: WRITABLE_STATUSES, description: 'Has a translation in this status' })
  @IsOptional()
  @IsIn(WRITABLE_STATUSES)
  status?: WritableStatus;

  @ApiPropertyOptional() @IsOptional() @IsUUID() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() industryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
}
