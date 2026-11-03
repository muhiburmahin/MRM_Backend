import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PageMeta {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class PublicImage {
  @ApiProperty() url!: string;
  @ApiPropertyOptional({ nullable: true }) width!: number | null;
  @ApiPropertyOptional({ nullable: true }) height!: number | null;
  @ApiProperty() alt!: string;
}

export class NamedRef {
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
}

export class PublicMetric {
  @ApiProperty() label!: string;
  @ApiProperty() value!: string;
}

export class PublicClient {
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) websiteUrl!: string | null;
  @ApiPropertyOptional({ type: PublicImage, nullable: true }) logo!: PublicImage | null;
}

export class PublicProjectListItem {
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty() summary!: string;
  @ApiPropertyOptional({ type: PublicImage, nullable: true }) cover!: PublicImage | null;
  @ApiProperty() publishedAt!: Date;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ default: 'COMPLETED' }) projectWorkStatus!: string;
  @ApiProperty({ default: false }) isFeatured!: boolean;
  @ApiPropertyOptional({ nullable: true }) demoVideoUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) frontendRepoUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) backendRepoUrl!: string | null;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  frontendTechSummary!: unknown;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  backendTechSummary!: unknown;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  dbToolsSummary!: unknown;
  @ApiPropertyOptional({ type: NamedRef, nullable: true }) service!: NamedRef | null;
  @ApiPropertyOptional({ type: NamedRef, nullable: true }) industry!: NamedRef | null;
  @ApiPropertyOptional({ type: NamedRef, nullable: true }) product!: NamedRef | null;
  @ApiPropertyOptional({ nullable: true, description: 'Only when the client approved disclosure' })
  clientName!: string | null;
}

export class PublicProjectDetail extends PublicProjectListItem {
  @ApiProperty() locale!: string;
  @ApiPropertyOptional({ nullable: true }) challenge!: string | null;
  @ApiPropertyOptional({ nullable: true }) solution!: string | null;
  @ApiPropertyOptional({ nullable: true }) result!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) body!: unknown;
  @ApiProperty({ type: [PublicMetric] }) metrics!: PublicMetric[];
  @ApiPropertyOptional({ type: PublicClient, nullable: true }) client!: PublicClient | null;
  @ApiPropertyOptional({ nullable: true }) seoTitle!: string | null;
  @ApiPropertyOptional({ nullable: true }) seoDescription!: string | null;
  @ApiProperty({ type: [String] }) availableLocales!: string[];
}

export class PublicProjectListResponse {
  @ApiProperty({ type: [PublicProjectListItem] }) data!: PublicProjectListItem[];
  @ApiProperty({ type: PageMeta }) meta!: PageMeta;
}

export class Visibility {
  @ApiProperty() isPublic!: boolean;
  @ApiProperty({ type: [String], description: 'Locales visible on the website right now' })
  locales!: string[];
  @ApiProperty({ type: [String], description: 'Why it is not public yet (empty when public)' })
  blockers!: string[];
}

export class AdminProject {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true }) clientId!: string | null;
  @ApiPropertyOptional({ nullable: true }) productId!: string | null;
  @ApiPropertyOptional({ nullable: true }) serviceId!: string | null;
  @ApiPropertyOptional({ nullable: true }) industryId!: string | null;
  @ApiPropertyOptional({ nullable: true }) coverId!: string | null;
  @ApiProperty({ type: [PublicMetric] }) metrics!: unknown;
  @ApiProperty() isVerified!: boolean;
  @ApiPropertyOptional({ nullable: true }) evidenceNote!: string | null;
  @ApiPropertyOptional({ nullable: true }) clientApprovedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) publishedAt!: Date | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ default: 'COMPLETED' }) projectWorkStatus!: string;
  @ApiProperty({ default: false }) isFeatured!: boolean;
  @ApiPropertyOptional({ nullable: true }) demoVideoUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) frontendRepoUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) backendRepoUrl!: string | null;
  @ApiProperty({ default: false }) showFrontendRepo!: boolean;
  @ApiProperty({ default: false }) showBackendRepo!: boolean;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  frontendTechSummary!: unknown;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  backendTechSummary!: unknown;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  dbToolsSummary!: unknown;
  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  translations!: unknown[];
  @ApiProperty({ type: Visibility }) visibility!: Visibility;
}

export class AdminProjectListResponse {
  @ApiProperty({ type: [AdminProject] }) data!: AdminProject[];
  @ApiProperty({ type: PageMeta }) meta!: PageMeta;
}
