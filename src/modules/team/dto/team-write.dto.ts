import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDate, IsEmail, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min,
  MinLength, ValidateNested,
} from 'class-validator';
import { LOCALE_RE, SLUG_RE } from '../team.constants';
import { IsSocialLinks, Trim } from './validators';

export class CreateTeamTranslationDto {
  @ApiProperty({ example: 'en' }) @Matches(LOCALE_RE)
  locale!: string;

  @ApiProperty({ maxLength: 120 }) @Trim() @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'Designation / job title', maxLength: 120 }) @Trim() @IsString() @MinLength(1) @MaxLength(120)
  roleTitle!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(2000)
  bio?: string | null;
}

export class UpsertTeamTranslationDto {
  @ApiProperty({ example: 'bn' }) @Matches(LOCALE_RE)
  locale!: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MinLength(1) @MaxLength(120)
  roleTitle?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(2000)
  bio?: string | null;
}

/** Fields shared by create and update (all optional here; create requires slug + translations). */
class TeamMemberFieldsDto {
  @ApiPropertyOptional({ maxLength: 80, nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(80)
  department?: string | null;

  @ApiPropertyOptional({ description: 'Work email. Shown publicly only if showEmail is true.', nullable: true })
  @IsOptional() @Trim() @IsEmail() @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  showEmail?: boolean;

  @ApiPropertyOptional({ description: 'Existing MediaAsset id (no upload here)', nullable: true }) @IsOptional() @IsUUID()
  photoId?: string | null;

  @ApiPropertyOptional({ example: { linkedin: 'https://www.linkedin.com/in/…' }, description: 'Allowed keys: linkedin, github, x, facebook, instagram, youtube, behance, dribbble, website (https only)' })
  @IsOptional() @IsSocialLinks()
  socialLinks?: Record<string, string>;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Type(() => Date) @IsDate()
  joinedAt?: Date | null;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) @Max(100_000)
  sortOrder?: number;

  @ApiPropertyOptional({ default: false, description: 'Listing on the public website. Requires the member\'s consent.' })
  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'true = the member agreed to be listed (recorded with a timestamp); false = consent withdrawn (also unpublishes).' })
  @IsOptional() @IsBoolean()
  consentGiven?: boolean;
}

export class CreateTeamMemberDto extends TeamMemberFieldsDto {
  @ApiProperty({ example: 'jane-doe' }) @Trim() @Matches(SLUG_RE) @MaxLength(80)
  slug!: string;

  @ApiProperty({ type: [CreateTeamTranslationDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => CreateTeamTranslationDto)
  translations!: CreateTeamTranslationDto[];
}

export class UpdateTeamMemberDto extends TeamMemberFieldsDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @Matches(SLUG_RE) @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ type: [UpsertTeamTranslationDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => UpsertTeamTranslationDto)
  translations?: UpsertTeamTranslationDto[];
}
