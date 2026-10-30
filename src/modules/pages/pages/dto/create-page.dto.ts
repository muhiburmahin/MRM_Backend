import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreatePageTranslationDto } from './page-translation.dto';

const PAGE_TEMPLATES = ['default', 'home', 'contact', 'legal', 'landing'] as const;

export class CreatePageDto {
  @ApiProperty({ example: 'about-us', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  key!: string;

  @ApiPropertyOptional({ enum: PAGE_TEMPLATES, default: 'default' })
  @IsOptional()
  @IsIn(PAGE_TEMPLATES)
  template?: (typeof PAGE_TEMPLATES)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  parentId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @ApiProperty({ type: [CreatePageTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePageTranslationDto)
  translations!: CreatePageTranslationDto[];
}
