import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReportingService } from './reporting.service.js';
import { EmployerGuard } from '../auth/employer.guard.js';
import type { ReportSummary } from '../contracts/index.js';

@Controller('reports')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('summary')
  @UseGuards(EmployerGuard)
  getSummary(): Promise<ReportSummary> {
    return this.reportingService.getSummary();
  }

  @Get('unconfirmed')
  @UseGuards(EmployerGuard)
  getUnconfirmedPeriods(): Promise<Array<{ workerKey: string; period: string; status: string; reason: string }>> {
    return this.reportingService.getUnconfirmedPeriods();
  }

  @Get('health')
  getHealth(): Promise<{ status: string; indexerReachable: boolean }> {
    return this.reportingService.getHealthStatus();
  }
}
