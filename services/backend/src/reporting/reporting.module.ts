import { Module } from '@nestjs/common';
import { ReportingService } from './reporting.service.js';
import { ReportingController } from './reporting.controller.js';
import { IndexerClient } from './indexer.client.js';

@Module({
  controllers: [ReportingController],
  providers: [ReportingService, IndexerClient],
  exports: [ReportingService],
})
export class ReportingModule {}
