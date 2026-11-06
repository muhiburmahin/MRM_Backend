import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export const REORDER_PLACEMENTS = [
  'servicesPageOrder',
  'homepageOrder',
  'navbarOrder',
  'featuredOrder',
  'sortOrder',
] as const;

export type ReorderPlacement = (typeof REORDER_PLACEMENTS)[number];

export class ReorderServiceItemDto {
  @ApiProperty({ description: 'Service UUID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'New order position (0-indexed or 1-indexed)' })
  @IsInt()
  @Min(0)
  order: number;
}

export class ReorderServicesDto {
  @ApiProperty({ enum: REORDER_PLACEMENTS, example: 'servicesPageOrder' })
  @IsIn(REORDER_PLACEMENTS)
  placement: ReorderPlacement;

  @ApiProperty({ type: [ReorderServiceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderServiceItemDto)
  items: ReorderServiceItemDto[];
}

