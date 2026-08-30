import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TimesheetsService } from './timesheets.service.js';
import { CreateTimesheetDto } from './dto/create-timesheet.dto.js';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto.js';
import { RecordOnChainDto } from './dto/record-onchain.dto.js';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto.js';
import { EmployerGuard } from '../auth/employer.guard.js';
import type { Timesheet, TimesheetStatus } from '../contracts/index.js';

@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get()
  @UseGuards(EmployerGuard)
  findAll(
    @Query('workerKey') workerKey?: string,
    @Query('period') period?: string,
    @Query('status') status?: TimesheetStatus,
  ): Timesheet[] {
    return this.timesheetsService.findAll({ workerKey, period, status });
  }

  @Post()
  create(@Body() dto: CreateTimesheetDto): Timesheet {
    return this.timesheetsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTimesheetDto): Timesheet {
    return this.timesheetsService.update(id, dto);
  }

  @Patch(':id/submit')
  submit(@Param('id') id: string): Timesheet {
    return this.timesheetsService.submit(id);
  }

  @Patch(':id/mark-pending-onchain')
  @UseGuards(EmployerGuard)
  markPendingOnChain(@Param('id') id: string): Timesheet {
    return this.timesheetsService.markPendingOnChain(id);
  }

  @Patch(':id/record-onchain')
  @UseGuards(EmployerGuard)
  recordOnChain(
    @Param('id') id: string,
    @Body() dto: RecordOnChainDto,
  ): Timesheet {
    return this.timesheetsService.recordOnChain(id, dto.onchainTxHash);
  }

  @Patch(':id/reject')
  @UseGuards(EmployerGuard)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTimesheetDto,
  ): Timesheet {
    return this.timesheetsService.reject(id, dto.reason);
  }
}
