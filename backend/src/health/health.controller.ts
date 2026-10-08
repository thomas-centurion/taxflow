import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { HealthResponseDto } from './health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Liveness check. Public.' })
  @Public()
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): { status: string } { return { status: 'ok' }; }
}