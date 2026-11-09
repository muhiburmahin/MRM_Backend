import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,

  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LOCALE_RE, SLUG_RE } from '../team.constants';
import { IsSocialLinks, Trim, TrimToNull } from './validators';

export class CreateTeamTranslationDto {
  @ApiProperty({ example: 'en' })
  @Matches(LOCALE_RE)
  locale!: string;

  @ApiProperty({ maxLength: 120 })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'Designation / job title', maxLength: 120 })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  roleTitle!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2000)
  bio?: string | null;
}

export class UpsertTeamTranslationDto {
  @ApiProperty({ example: 'bn' })
  @Matches(LOCALE_RE)
  locale!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  roleTitle?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2000)
  bio?: string | null;
}

/** Fields shared by create and update (all optional here; create requires slug + translations). */
class TeamMemberFieldsDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  role?: string;

  @ApiPropertyOptional({ description: 'Direct image URL or upload URL' })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  photo?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(5000)
  bio?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  linkedinUrl?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  githubUrl?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(80)
  department?: string | null;

  @ApiPropertyOptional({
    description: 'Work email. Shown publicly only if showEmail is true.',
    nullable: true,
  })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showEmail?: boolean;

  @ApiPropertyOptional({ description: 'Existing MediaAsset id (no upload here)', nullable: true })
  @IsOptional()
  @IsUUID()
  photoId?: string | null;

  @ApiPropertyOptional({
    example: { linkedin: 'https://www.linkedin.com/in/…' },
    description:
      'Allowed keys: linkedin, github, x, facebook, instagram, youtube, behance, dribbble, website (https only)',
  })
  @IsOptional()
  @IsSocialLinks()
  socialLinks?: Record<string, string>;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  joinedAt?: Date | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder?: number;

  @ApiPropertyOptional({
    default: true,
    description: "Listing on the public website. Requires the member's consent.",
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description:
      'true = the member agreed to be listed (recorded with a timestamp); false = consent withdrawn (also unpublishes).',
  })
  @IsOptional()
  @IsBoolean()
  consentGiven?: boolean;
}

export class CreateTeamMemberDto extends TeamMemberFieldsDto {
  @ApiPropertyOptional({ example: 'jane-doe' })
  @IsOptional()
  @Trim()
  @Matches(SLUG_RE)
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ type: [CreateTeamTranslationDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateTeamTranslationDto)
  translations?: CreateTeamTranslationDto[];
}

export class UpdateTeamMemberDto extends TeamMemberFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @Matches(SLUG_RE)
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ type: [UpsertTeamTranslationDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => UpsertTeamTranslationDto)
  translations?: UpsertTeamTranslationDto[];
}
