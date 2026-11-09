import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  CleanBlock,
  CleanLine,
  IsCleanMessage,
  IsPersonName,
  IsStrictEmail,
  NormalizeEmail,
} from '../../../common/validators/public-input';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class StartProjectDto {
  @ApiProperty({ example: 'Karim Ahmed' })
  @CleanLine()
  @IsString()
  @Length(2, 100)
  @IsPersonName()
  name!: string;

  @ApiProperty({ example: 'karim@company.com' })
  @NormalizeEmail()
  @IsStrictEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: '+8801700000000' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9\s\-()]{6,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Acme Corporation' })
  @IsOptional()
  @CleanLine()
  @IsString()
  @MaxLength(150)
  company?: string;

  @ApiPropertyOptional({ example: 'Custom Enterprise Software' })
  @IsOptional()
  @CleanLine()
  @IsString()
  @MaxLength(100)
  serviceInterested?: string;

  @ApiPropertyOptional({ example: '$10,000 - $25,000' })
  @IsOptional()
  @CleanLine()
  @IsString()
  @MaxLength(100)
  budgetRange?: string;

  @ApiPropertyOptional({ example: '3-6 months' })
  @IsOptional()
  @CleanLine()
  @IsString()
  @MaxLength(100)
  timeline?: string;

  @ApiProperty({ example: 'We need a scalable microservices-based logistics platform.' })
  @CleanBlock()
  @IsString()
  @Length(10, 5000)
  @IsCleanMessage()
  message!: string;

  @ApiProperty({
    example: true,
    description: 'Must be true to record explicit consent to be contacted regarding this project.',
  })
  @IsBoolean()
  consentGiven!: boolean;
}
