import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject } from 'class-validator';

export const PRODUCT_SECTIONS = [
  'basic',
  'media',
  'features',
  'benefits',
  'links',
  'demonstrations',
  'faqs',
  'visibility',
  'seo',
] as const;

export type ProductSection = (typeof PRODUCT_SECTIONS)[number];

export class UpdateProductSectionDto {
  @ApiProperty({ enum: PRODUCT_SECTIONS, example: 'basic' })
  @IsIn(PRODUCT_SECTIONS)
  @IsNotEmpty()
  section: ProductSection;

  @ApiProperty({ description: 'Payload specific to the selected section' })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, unknown>;
}
