import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
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

  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^(\/uploads\/[\w.-]+|https?:\/\/\S+)$/, {
    message: 'avatarUrl must be an /uploads path or an http(s) URL',
  })
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ example: 'custom-software-development' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serviceSlug?: string;

  @ApiPropertyOptional({ example: 'edumanage-bd' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  projectSlug?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  reviewDate?: string;

  @ApiPropertyOptional({ example: 'Direct Client' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ example: { en: 'A genuine customer quote', bn: 'একটি প্রকৃত গ্রাহক মতামত' } })
  @IsDefined()
  quote: Record<string, string> | string;

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
