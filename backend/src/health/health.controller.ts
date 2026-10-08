import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';
import { ApiErrorResponses } from '../common/swagger/api-docs.decorators';
import { HealthResponseDto, ReadinessResponseDto } from './health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @ApiOperation({ summary: 'Liveness check: the process is up. Public.' })
  @Public()
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): { status: string } { return { status: 'ok' }; }

  @ApiOperation({ summary: 'Readiness check: the process can reach PostgreSQL. Public.' })
  @Public()
  @Get('ready')
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiErrorResponses([503, 'PostgreSQL is not reachable.'])
  async getReadiness(): Promise<ReadinessResponseDto> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      // The driver error can include host names: it is not exposed to anonymous callers.
      throw new ServiceUnavailableException('Database is not reachable.');
    }
    return { status: 'ok', database: 'up' };
  }
}
