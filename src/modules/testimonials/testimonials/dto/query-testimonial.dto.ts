import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const TESTIMONIAL_SORT_FIELDS = ['sortOrder'] as const;
const toBool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

export class QueryTestimonialDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale: string = 'en';

  @ApiPropertyOptional({ enum: TESTIMONIAL_SORT_FIELDS, default: 'sortOrder' })
  @IsOptional() @IsIn(TESTIMONIAL_SORT_FIELDS)
  sortBy: (typeof TESTIMONIAL_SORT_FIELDS)[number] = 'sortOrder';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional() @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}

/** Admin-only extra filter; public queries cannot see or override publication state. */
export class AdminQueryTestimonialDto extends QueryTestimonialDto {
  @ApiPropertyOptional({ description: 'Filter by public visibility' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  showOnSite?: boolean;

  @ApiPropertyOptional({ description: 'Filter by evidence verification state' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isVerified?: boolean;
}
