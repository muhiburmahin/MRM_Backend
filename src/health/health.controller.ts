import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/auth.decorators';
import { LivenessDto, ReadinessDto } from './health.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: the process is running and reports safe telemetry. Does not touch the database. */
  @Get()
  @ApiOkResponse({ type: LivenessDto })
  liveness(): LivenessDto {
    const mem = process.memoryUsage();
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime() * 10) / 10,
      timestamp: new Date().toISOString(),
      system: {
        memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      },
    };
  }

  /** Lightweight liveness probe for Kubernetes / Docker. Does not touch the database. */
  @Get('live')
  @ApiOkResponse({ type: LivenessDto })
  live(): LivenessDto {
    return this.liveness();
  }

  /** Readiness: the app can serve traffic (database reachable). Use this for load balancers. */
  @Get('ready')
  @ApiOkResponse({ type: ReadinessDto })
  @ApiServiceUnavailableResponse({ description: 'Database is not reachable' })
  async readiness(): Promise<ReadinessDto> {
    if (!(await this.health.isDatabaseUp())) {
      throw new ServiceUnavailableException('Service not ready');
    }
    return { status: 'ok', checks: { database: 'up' } };
  }
}
