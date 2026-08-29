import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import type { DirectoryEntry } from '../contracts/index.js';
import type { CreateDirectoryEntryDto } from './dto/create-entry.dto.js';

const DEMO_KARIM = '0x7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a';
const DEMO_DANA  = '0x91b291b291b291b291b291b291b291b291b291b291b291b291b291b291b291b2';
const DEMO_SAM   = '0xc4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8';

@Injectable()
export class DirectoryService {
  private readonly entries = new Map<string, DirectoryEntry>();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    this.entries.set(DEMO_KARIM, {
      workerKey: DEMO_KARIM,
      fullName: 'Karim Al-Mansoor',
      email: 'karim@example.com',
      department: 'Engineering',
      jobTitle: 'Senior Software Engineer',
    });

    this.entries.set(DEMO_DANA, {
      workerKey: DEMO_DANA,
      fullName: 'Dana Vance',
      email: 'dana@example.com',
      department: 'Design',
      jobTitle: 'Product Designer',
    });

    this.entries.set(DEMO_SAM, {
      workerKey: DEMO_SAM,
      fullName: 'Sam Miller',
      email: 'sam@example.com',
      department: 'Operations',
      jobTitle: 'Operations Specialist',
    });
  }

  findAll(): DirectoryEntry[] {
    return Array.from(this.entries.values());
  }

  findByWorkerKey(workerKey: string): DirectoryEntry {
    const entry = this.entries.get(workerKey);
    if (!entry) {
      throw new NotFoundException(`Directory entry for workerKey ${workerKey} not found`);
    }
    return entry;
  }

  create(dto: CreateDirectoryEntryDto): DirectoryEntry {
    if (this.entries.has(dto.workerKey)) {
      throw new ConflictException(`Directory entry already exists for workerKey ${dto.workerKey}`);
    }

    const entry: DirectoryEntry = {
      workerKey: dto.workerKey,
      fullName: dto.fullName,
      email: dto.email,
      department: dto.department,
      jobTitle: dto.jobTitle,
    };

    this.entries.set(dto.workerKey, entry);
    return entry;
  }

  remove(workerKey: string): void {
    if (!this.entries.has(workerKey)) {
      throw new NotFoundException(`Directory entry for workerKey ${workerKey} not found`);
    }
    this.entries.delete(workerKey);
  }
}
