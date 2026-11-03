import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType } from '@prisma/client';

export class PublicJobListItem {
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: EmploymentType }) type!: EmploymentType;
  @ApiPropertyOptional({ nullable: true }) location!: string | null;
  @ApiProperty() isRemote!: boolean;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) closesAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class PublicJobDetail extends PublicJobListItem {
  @ApiProperty() locale!: string;
  @ApiProperty() body!: string;
  @ApiPropertyOptional({ nullable: true }) applyEmail!: string | null;
  @ApiProperty({ type: [String] }) availableLocales!: string[];
}

export class AdminJobListItem {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: EmploymentType }) type!: EmploymentType;
  @ApiPropertyOptional({ nullable: true }) location!: string | null;
  @ApiProperty() isRemote!: boolean;
  @ApiProperty() isOpen!: boolean;
  @ApiPropertyOptional({ nullable: true }) applyEmail!: string | null;
  @ApiPropertyOptional({ nullable: true }) closesAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: 'array', items: { type: 'object' } }) translations!: unknown[];
}

