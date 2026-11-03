import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({
    format: 'password',
    description: 'Min 12 characters. Further rules enforced server-side.',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
