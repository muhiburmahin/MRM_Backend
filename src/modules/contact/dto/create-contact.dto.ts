import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Public input only. Status, internal notes and ids are NOT accepted here.
 * Requires ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }) globally.
 */
export class CreateContactDto {
  @ApiProperty({ example: 'Rahim Uddin' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ example: 'rahim@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ example: '+8801700000000' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9\s\-()]{6,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Website development inquiry' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  subject?: string;

  @ApiProperty({ example: 'I would like a quote for a company website.' })
  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  message: string;

  @ApiProperty({
    example: true,
    description: 'Must be true to record the submitter’s explicit consent to be contacted.',
  })
  @IsBoolean()
  consentGiven: boolean;
}
