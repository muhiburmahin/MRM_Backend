import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRedirectDto {
  @ApiProperty({ example: '/old-about' })
  @IsString()
  @IsNotEmpty()
  fromPath: string;

  @ApiProperty({ example: '/about' })
  @IsString()
  @IsNotEmpty()
  toPath: string;

  @ApiPropertyOptional({ example: 301, default: 301 })
  @IsOptional()
  @IsIn([301, 302, 307, 308])
  statusCode?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
