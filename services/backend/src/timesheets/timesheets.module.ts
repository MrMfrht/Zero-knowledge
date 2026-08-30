import { Module } from '@nestjs/common';
import { TimesheetsService } from './timesheets.service.js';
import { TimesheetsController } from './timesheets.controller.js';

@Module({
  controllers: [TimesheetsController],
  providers: [TimesheetsService],
  exports: [TimesheetsService],
})
export class TimesheetsModule {}
