import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  ADMIN_SORT_FIELDS, LOCALE_RE, PUBLIC_SORT_FIELDS, SLUG_RE, SortOrder, WRITABLE_STATUSES, WritableStatus,
} from '../services.constants';
import { ToBoolean, Trim } from './validators';

export class ServiceLocaleQueryDto {
  @ApiPropertyOptional({ example: 'en', description: 'Defaults to the default language configured in the Language table' })
  @IsOptional() @Matches(LOCALE_RE)
  locale?: string;
}

export class ServiceSlugParamDto {
  @Matches(SLUG_RE) @MaxLength(80)
  slug!: string;
}

export class QueryServicesDto extends ServiceLocaleQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000)
  page: number = 1;

  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit: number = 12;

  @ApiPropertyOptional({ enum: PUBLIC_SORT_FIELDS, default: 'sortOrder' })
  @IsOptional() @IsIn(PUBLIC_SORT_FIELDS)
  sort: (typeof PUBLIC_SORT_FIELDS)[number] = 'sortOrder';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional() @IsIn(['asc', 'desc'])
  order: SortOrder = 'asc';

  @ApiPropertyOptional({ description: 'Search in name and summary', maxLength: 100 })
  @IsOptional() @Trim() @IsString() @MaxLength(100)
  q?: string;
}

export class AdminQueryServicesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: ADMIN_SORT_FIELDS, default: 'sortOrder' })
  @IsOptional() @IsIn(ADMIN_SORT_FIELDS)
  sort: (typeof ADMIN_SORT_FIELDS)[number] = 'sortOrder';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional() @IsIn(['asc', 'desc'])
  order: SortOrder = 'asc';

  @ApiPropertyOptional({ description: 'Search in slug and translated names' })
  @IsOptional() @Trim() @IsString() @MaxLength(100)
  q?: string;

  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsIn([true, false])
  isActive?: boolean;

  @ApiPropertyOptional({ enum: [...WRITABLE_STATUSES, 'SCHEDULED'], description: 'Has a translation in this status' })
  @IsOptional() @IsIn([...WRITABLE_STATUSES, 'SCHEDULED'])
  status?: WritableStatus | 'SCHEDULED';
}
