import { Controller, Get } from '@nestjs/common';
import type { ErpCall } from '../connectors/erp.client';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    const call: ErpCall = () => 'ok';
    return { status: call() };
  }
}
