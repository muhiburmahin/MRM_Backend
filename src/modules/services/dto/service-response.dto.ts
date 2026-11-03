import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PageMeta {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class PublicServiceListItem {
  @ApiProperty({ example: 'web-development' }) slug!: string;
  @ApiPropertyOptional({ nullable: true }) icon!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() name!: string;
  @ApiProperty() summary!: string;
  @ApiPropertyOptional({ nullable: true }) publishedAt!: Date | null;
}

export class PublicServiceDetail extends PublicServiceListItem {
  @ApiProperty() locale!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) body!: unknown;
  @ApiPropertyOptional({ nullable: true }) seoTitle!: string | null;
  @ApiPropertyOptional({ nullable: true }) seoDescription!: string | null;
  @ApiProperty({
    type: [String],
    description: 'Locales in which this service is published (for a language switcher)',
  })
  availableLocales!: string[];
}

export class PublicServiceListResponse {
  @ApiProperty({ type: [PublicServiceListItem] }) data!: PublicServiceListItem[];
  @ApiProperty({ type: PageMeta }) meta!: PageMeta;
}

export class AdminTranslationResponse {
  @ApiProperty() locale!: string;
  @ApiProperty() name!: string;
  @ApiProperty() summary!: string;
  @ApiProperty() body!: unknown;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ nullable: true }) publishedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) seoTitle!: string | null;
  @ApiPropertyOptional({ nullable: true }) seoDescription!: string | null;
}

export class AdminServiceResponse {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true }) icon!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: [AdminTranslationResponse] }) translations!: AdminTranslationResponse[];
}

export class AdminTranslationSummary {
  @ApiProperty() locale!: string;
  @ApiProperty() name!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ nullable: true }) publishedAt!: Date | null;
}

export class AdminServiceListItem {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true }) icon!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: [AdminTranslationSummary] }) translations!: AdminTranslationSummary[];
}

export class AdminServiceListResponse {
  @ApiProperty({ type: [AdminServiceListItem] }) data!: AdminServiceListItem[];
  @ApiProperty({ type: PageMeta }) meta!: PageMeta;
}
