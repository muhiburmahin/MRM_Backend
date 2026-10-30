import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  Allow,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Registers an asset stored by an externally configured storage pipeline; this API selects no provider. */
export class UploadMediaDto {
  @ApiProperty({ enum: MediaKind })
  @IsEnum(MediaKind)
  kind: MediaKind;

  @ApiProperty({ maxLength: 500, description: 'Provider-relative object key' })
  @Transform(trim)
  @IsString()
  @Length(1, 500)
  storageKey: string;

  @ApiProperty({ example: 'https://cdn.example.com/media/image.png' })
  @Transform(trim)
  @Length(1, 2000)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  fileName: string;

  @ApiProperty({ example: 'image/png', maxLength: 150 })
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  mimeType: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  folderId?: string | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  width?: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  height?: number | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  blurHash?: string | null;

  @ApiPropertyOptional({ description: 'Localized alternative text JSON' })
  @IsOptional()
  @Allow()
  alt?: unknown;

  @ApiPropertyOptional({ description: 'Localized caption JSON' })
  @IsOptional()
  @Allow()
  caption?: unknown;
}
