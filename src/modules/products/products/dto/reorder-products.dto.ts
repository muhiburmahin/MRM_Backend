import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReorderItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order: number;
}

export const REORDER_CONTEXTS = [
  'displayOrder',
  'homepageOrder',
  'navOrder',
  'featuredOrder',
] as const;

export type ReorderContext = (typeof REORDER_CONTEXTS)[number];

export class ReorderProductsDto {
  @ApiProperty({ enum: REORDER_CONTEXTS, example: 'displayOrder' })
  @IsIn(REORDER_CONTEXTS)
  context: ReorderContext;

  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
