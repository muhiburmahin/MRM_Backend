import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateFaqDto {
  @ApiProperty({
    example: {
      en: { question: 'How long does a project take?', answer: 'It depends on the scope.' },
      bn: { question: 'প্রকল্পে কত দিন লাগে?', answer: 'পরিধির ওপর নির্ভর করে।' },
    },
  })
  @IsObject()
  i18n: Record<string, { question: string; answer: string }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ default: 0, description: 'Display position, lower comes first' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
