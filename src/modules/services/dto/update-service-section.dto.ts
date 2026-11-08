import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject } from 'class-validator';

export const SERVICE_SECTIONS = [
  'basic',
  'offerings',
  'benefits',
  'process',
  'technologies',
  'media',
  'projects',
  'faqs',
  'visibility',
  'seo',
] as const;

export type ServiceSection = (typeof SERVICE_SECTIONS)[number];

export class UpdateServiceSectionDto {
  @ApiProperty({ enum: SERVICE_SECTIONS, example: 'basic' })
  @IsIn(SERVICE_SECTIONS)
  @IsNotEmpty()
  section: ServiceSection;

  @ApiProperty({ description: 'Payload specific to the selected service tab section' })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, unknown>;
}
