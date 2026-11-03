import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UploadFileDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Optional media folder ID' })
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ApiPropertyOptional({ description: 'Optional alt text string or JSON' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt?: string;

  @ApiPropertyOptional({ description: 'Optional caption string or JSON' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string;
}
