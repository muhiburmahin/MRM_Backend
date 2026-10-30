import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class InviteUserDto {
  @ApiProperty({ format: 'email' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 168, default: 72 })
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours = 72;
}

export class QueryInvitesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'accepted', 'expired'] })
  @IsOptional()
  @IsIn(['pending', 'accepted', 'expired'])
  status?: 'pending' | 'accepted' | 'expired';
}
