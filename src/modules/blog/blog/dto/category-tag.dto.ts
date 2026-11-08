import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCategoryDto {
  @ApiProperty({ example: 'software-engineering' })
  @IsString()
  @IsNotEmpty()
  @Matches(SLUG_PATTERN, { message: 'Slug must be kebab-case' })
  slug: string;

  @ApiProperty({
    example: { en: { name: 'Software Engineering' }, bn: { name: 'সফটওয়্যার ইঞ্জিনিয়ারিং' } },
  })
  @IsObject()
  i18n: Record<string, unknown>;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'software-engineering' })
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'Slug must be kebab-case' })
  slug?: string;

  @ApiPropertyOptional({
    example: { en: { name: 'Software Engineering' }, bn: { name: 'সফটওয়্যার ইঞ্জিনিয়ারিং' } },
  })
  @IsOptional()
  @IsObject()
  i18n?: Record<string, unknown>;
}

export class CreateTagDto {
  @ApiProperty({ example: 'next-js' })
  @IsString()
  @IsNotEmpty()
  @Matches(SLUG_PATTERN, { message: 'Slug must be kebab-case' })
  slug: string;

  @ApiProperty({
    example: { en: { name: 'Next.js' }, bn: { name: 'নেক্সট.জেএস' } },
  })
  @IsObject()
  i18n: Record<string, unknown>;
}
