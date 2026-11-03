import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SystemTelemetryDto {
  @ApiProperty({ example: 45.2 }) memoryRssMb: number;
  @ApiProperty({ example: 28.6 }) heapUsedMb: number;
}

export class LivenessDto {
  @ApiProperty({ example: 'ok' }) status: 'ok';
  @ApiProperty({ example: 123.4 }) uptimeSeconds: number;
  @ApiProperty({ example: '2026-10-10T12:00:00.000Z' }) timestamp: string;
  @ApiPropertyOptional({ type: SystemTelemetryDto }) system?: SystemTelemetryDto;
}

export class ReadinessDto {
  @ApiProperty({ example: 'ok' }) status: 'ok';
  @ApiProperty({ example: { database: 'up' } }) checks: { database: 'up' };
}
