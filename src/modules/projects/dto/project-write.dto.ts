import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LOCALE_RE, SLUG_RE, WRITABLE_STATUSES, WritableStatus } from '../projects.constants';
import { IsMetrics, MaxJsonSize, Metric, Trim } from './validators';

const BODY_MAX = 100_000;

class TranslationFields {
  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  challenge?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  solution?: string | null;

  @ApiPropertyOptional({
    description: 'Outcome. Only describe verifiable results.',
    maxLength: 2000,
    nullable: true,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  result?: string | null;

  @ApiPropertyOptional({
    description: 'Free-form JSON (max ~100k chars). Frontend must render it safely.',
  })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(BODY_MAX)
  body?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: WRITABLE_STATUSES })
  @IsOptional()
  @IsIn(WRITABLE_STATUSES)
  status?: WritableStatus;

  @ApiPropertyOptional({ maxLength: 70, nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(70)
  seoTitle?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  seoDescription?: string | null;
}

export class CreateProjectTranslationDto extends TranslationFields {
  @ApiProperty({ example: 'en' })
  @Matches(LOCALE_RE)
  locale!: string;

  @ApiProperty({ maxLength: 160 })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ maxLength: 500 })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary!: string;
}

export class UpsertProjectTranslationDto extends TranslationFields {
  @ApiProperty({ example: 'bn' })
  @Matches(LOCALE_RE)
  locale!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary?: string;
}

class ProjectFieldsDto {
  @ApiPropertyOptional({ description: 'Client id (existing Client)', nullable: true })
  @IsOptional()
  @IsUUID()
  clientId?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() productId?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() serviceId?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() industryId?: string | null;

  @ApiPropertyOptional({ description: 'Existing MediaAsset id (no upload here)', nullable: true })
  @IsOptional()
  @IsUUID()
  coverId?: string | null;

  @ApiPropertyOptional({
    example: [{ label: 'Delivery time', value: '8 weeks' }],
    description: 'Only verifiable figures (max 10)',
  })
  @IsOptional()
  @IsMetrics()
  metrics?: Metric[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder?: number;

  // ── Trust fields: require the publish permission ──
  @ApiPropertyOptional({
    description: 'Facts have been verified. Requires evidenceNote. Needs casestudy:publish.',
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description:
      'What proves the facts (contract, written approval…). Internal only, never public.',
    nullable: true,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  evidenceNote?: string | null;

  @ApiPropertyOptional({
    description:
      'When the client approved publication. Required for public visibility if a client is linked.',
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  clientApprovedAt?: Date | null;

  @ApiPropertyOptional({
    description:
      'Go-live time. Set automatically on first publish if empty; a future date schedules it.',
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date | null;

  @ApiPropertyOptional({ example: 'COMPLETED', default: 'COMPLETED' })
  @IsOptional()
  @IsString()
  projectWorkStatus?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  demoVideoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  frontendRepoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  backendRepoUrl?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showFrontendRepo?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showBackendRepo?: boolean;

  @ApiPropertyOptional({
    description: 'Frontend tech stack summary (e.g. ["Next.js", "TypeScript"])',
  })
  @IsOptional()
  frontendTechSummary?: unknown;

  @ApiPropertyOptional({
    description: 'Backend tech stack summary (e.g. ["NestJS", "PostgreSQL"])',
  })
  @IsOptional()
  backendTechSummary?: unknown;

  @ApiPropertyOptional({ description: 'Database and tools summary (e.g. ["Redis", "Docker"])' })
  @IsOptional()
  dbToolsSummary?: unknown;
}

export class CreateProjectDto extends ProjectFieldsDto {
  @ApiProperty({ example: 'school-management-rollout' })
  @Trim()
  @Matches(SLUG_RE)
  @MaxLength(80)
  slug!: string;

  @ApiProperty({ type: [CreateProjectTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateProjectTranslationDto)
  translations!: CreateProjectTranslationDto[];
}

export class UpdateProjectDto extends ProjectFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @Matches(SLUG_RE)
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ type: [UpsertProjectTranslationDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => UpsertProjectTranslationDto)
  translations?: UpsertProjectTranslationDto[];
}
