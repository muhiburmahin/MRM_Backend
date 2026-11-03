import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PageMeta {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class PublicPhoto {
  @ApiProperty() url!: string;
  @ApiPropertyOptional({ nullable: true }) width!: number | null;
  @ApiPropertyOptional({ nullable: true }) height!: number | null;
  @ApiProperty() alt!: string;
}

export class PublicTeamListItem {
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'Designation' }) roleTitle!: string;
  @ApiPropertyOptional({ nullable: true }) department!: string | null;
  @ApiPropertyOptional({ type: PublicPhoto, nullable: true }) photo!: PublicPhoto | null;
  @ApiProperty() sortOrder!: number;
}

export class PublicTeamDetail extends PublicTeamListItem {
  @ApiProperty() locale!: string;
  @ApiPropertyOptional({ nullable: true }) bio!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } }) socialLinks!: Record<
    string,
    string
  >;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Only present when the member chose to show it',
  })
  email!: string | null;
  @ApiProperty({ type: [String] }) availableLocales!: string[];
}

export class PublicTeamListResponse {
  @ApiProperty({ type: [PublicTeamListItem] }) data!: PublicTeamListItem[];
  @ApiProperty({ type: PageMeta }) meta!: PageMeta;
}

export class AdminTeamTranslation {
  @ApiProperty() locale!: string;
  @ApiProperty() name!: string;
  @ApiProperty() roleTitle!: string;
  @ApiPropertyOptional({ nullable: true }) bio?: string | null;
}

export class AdminTeamMember {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true }) photoId!: string | null;
  @ApiPropertyOptional({ nullable: true }) department!: string | null;
  @ApiPropertyOptional({ nullable: true }) email?: string | null;
  @ApiPropertyOptional() showEmail?: boolean;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) socialLinks?: unknown;
  @ApiProperty() isPublic!: boolean;
  @ApiPropertyOptional({ nullable: true }) consentAt!: Date | null;
  @ApiProperty() sortOrder!: number;
  @ApiPropertyOptional({ nullable: true }) joinedAt!: Date | null;
  @ApiProperty({ type: [AdminTeamTranslation] }) translations!: AdminTeamTranslation[];
}

export class AdminTeamListResponse {
  @ApiProperty({ type: [AdminTeamMember] }) data!: AdminTeamMember[];
  @ApiProperty({ type: PageMeta }) meta!: PageMeta;
}
