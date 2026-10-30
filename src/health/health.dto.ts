import { ApiProperty } from '@nestjs/swagger';

export class LivenessDto {
  @ApiProperty({ example: 'ok' }) status: 'ok';
  @ApiProperty({ example: 123.4 }) uptimeSeconds: number;
  @ApiProperty({ example: '2026-10-10T12:00:00.000Z' }) timestamp: string;
}

export class ReadinessDto {
  @ApiProperty({ example: 'ok' }) status: 'ok';
  @ApiProperty({ example: { database: 'up' } }) checks: { database: 'up' };
}
