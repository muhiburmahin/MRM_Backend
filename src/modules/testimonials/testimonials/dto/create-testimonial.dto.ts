import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTestimonialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty({ example: 'Rahim Uddin' })
  @IsString()
  @Length(2, 100)
  authorName: string;

  @ApiPropertyOptional({ example: 'Managing Director' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  authorRole?: string;

  @ApiProperty({ example: { en: 'A genuine customer quote', bn: 'একটি প্রকৃত গ্রাহক মতামত' } })
  @IsObject()
  quote: Record<string, string>;

  @ApiPropertyOptional({ description: 'Written evidence/source for this real testimonial' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidenceNote?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  consentAt?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ default: 0, description: 'Display position, lower comes first' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showOnSite?: boolean;
}
