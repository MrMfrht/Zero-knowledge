import { Module } from '@nestjs/common';
import { DirectoryService } from './directory.service.js';
import { DirectoryController } from './directory.controller.js';

@Module({
  controllers: [DirectoryController],
  providers: [DirectoryService],
  exports: [DirectoryService],
})
export class DirectoryModule {}
