import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class JobTranslationDto {
  @ApiProperty({ example: 'en' })
  @Transform(trim)
  @IsString()
  @Length(2, 10)
  locale!: string;

  @ApiProperty({ example: 'Senior Full Stack Engineer' })
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiProperty({ example: 'We are seeking an experienced engineer...' })
  @Transform(trim)
  @IsString()
  @Length(10, 50000)
  body!: string;
}

export class CreateJobDto {
  @ApiProperty({ example: 'senior-full-stack-engineer' })
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be lowercase kebab-case' })
  slug!: string;

  @ApiProperty({ enum: EmploymentType, default: EmploymentType.FULL_TIME })
  @IsEnum(EmploymentType)
  type: EmploymentType = EmploymentType.FULL_TIME;

  @ApiPropertyOptional({ example: 'Dhaka, Bangladesh' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRemote?: boolean = false;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean = true;

  @ApiPropertyOptional({ example: 'careers@mrminfotech.com' })
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  applyEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  closesAt?: Date;

  @ApiProperty({ type: [JobTranslationDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => JobTranslationDto)
  translations!: JobTranslationDto[];
}

export class UpdateJobDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be lowercase kebab-case' })
  slug?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  type?: EmploymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRemote?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  applyEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  closesAt?: Date;

  @ApiPropertyOptional({ type: [JobTranslationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobTranslationDto)
  translations?: JobTranslationDto[];
}

export class UpdateJobStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isOpen!: boolean;
}

export class ApplyJobDto {
  @ApiProperty({ example: 'John Doe' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiProperty({ example: 'john@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: '+8801700000000' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9\s\-()]{6,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/johndoe or portfolio URL' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  resumeUrl?: string;

  @ApiPropertyOptional({ example: 'I am excited to apply for this role...' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  coverLetter?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  consentGiven!: boolean;
}

