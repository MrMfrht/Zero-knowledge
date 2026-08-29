import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DirectoryService } from './directory.service.js';
import { CreateDirectoryEntryDto } from './dto/create-entry.dto.js';
import { EmployerGuard } from '../auth/employer.guard.js';
import type { DirectoryEntry } from '../contracts/index.js';

@Controller('directory')
@UseGuards(EmployerGuard)
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get()
  findAll(): DirectoryEntry[] {
    return this.directoryService.findAll();
  }

  @Get(':workerKey')
  findOne(@Param('workerKey') workerKey: string): DirectoryEntry {
    return this.directoryService.findByWorkerKey(workerKey);
  }

  @Post()
  create(@Body() dto: CreateDirectoryEntryDto): DirectoryEntry {
    return this.directoryService.create(dto);
  }

  @Delete(':workerKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('workerKey') workerKey: string): void {
    this.directoryService.remove(workerKey);
  }
}
