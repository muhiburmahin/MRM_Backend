import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateNavigationMenuDto {
  @ApiProperty({ example: 'header', maxLength: 80 })
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  key!: string;
}

export class UpdateNavigationMenuDto extends PartialType(CreateNavigationMenuDto) {}

export class CreateNavigationItemDto {
  @ApiProperty({ example: { en: 'About', bn: 'আমাদের সম্পর্কে' } })
  @IsObject()
  label!: Record<string, string>;

  @ApiPropertyOptional({ example: { en: 'Learn about our company' } })
  @IsOptional()
  @IsObject()
  description?: Record<string, string>;

  @ApiPropertyOptional({ example: { en: 'New' } })
  @IsOptional()
  @IsObject()
  badge?: Record<string, string>;

  @ApiPropertyOptional({ example: 'building' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  iconKey?: string;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2048)
  href?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Internal target; specify exactly one target',
  })
  @IsOptional()
  @IsUUID()
  pageId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Internal target; specify exactly one target',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Internal target; specify exactly one target',
  })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Must refer to another item in this menu' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  newTab?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isButton?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class UpdateNavigationItemDto extends PartialType(CreateNavigationItemDto) {}

export class ReorderNavigationItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ minimum: 0, maximum: 100000 })
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder!: number;
}

export class ReorderNavigationItemsDto {
  @ApiProperty({ type: [ReorderNavigationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderNavigationItemDto)
  items!: ReorderNavigationItemDto[];
}
