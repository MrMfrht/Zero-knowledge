import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Timesheet, TimesheetStatus } from '../contracts/index.js';
import type { CreateTimesheetDto } from './dto/create-timesheet.dto.js';
import type { UpdateTimesheetDto } from './dto/update-timesheet.dto.js';

const DEMO_KARIM = '0x7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a';
const DEMO_DANA  = '0x91b291b291b291b291b291b291b291b291b291b291b291b291b291b291b291b2';

@Injectable()
export class TimesheetsService {
  private readonly timesheets = new Map<string, Timesheet>();
  private idCounter = 1;

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const karimTs: Timesheet = {
      id: 'ts-1',
      workerKey: DEMO_KARIM,
      period: '2026-04',
      hours: 1,
      note: 'Monthly salaried fixed period',
      status: 'approved-onchain',
      onchainTxHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      updatedAt: new Date().toISOString(),
    };

    const danaTs: Timesheet = {
      id: 'ts-2',
      workerKey: DEMO_DANA,
      period: '2026-04',
      hours: 47,
      note: 'April hourly timesheet for review',
      status: 'submitted',
      updatedAt: new Date().toISOString(),
    };

    this.timesheets.set(karimTs.id, karimTs);
    this.timesheets.set(danaTs.id, danaTs);
    this.idCounter = 3;
  }

  findAll(query?: { workerKey?: string; period?: string; status?: TimesheetStatus }): Timesheet[] {
    let list = Array.from(this.timesheets.values());

    if (query?.workerKey) {
      list = list.filter((t) => t.workerKey === query.workerKey);
    }
    if (query?.period) {
      list = list.filter((t) => t.period === query.period);
    }
    if (query?.status) {
      list = list.filter((t) => t.status === query.status);
    }

    return list;
  }

  findById(id: string): Timesheet {
    const ts = this.timesheets.get(id);
    if (!ts) {
      throw new NotFoundException(`Timesheet with id ${id} not found`);
    }
    return ts;
  }

  create(dto: CreateTimesheetDto): Timesheet {
    const id = `ts-${this.idCounter++}`;
    const ts: Timesheet = {
      id,
      workerKey: dto.workerKey,
      period: dto.period,
      hours: dto.hours,
      ...(dto.note ? { note: dto.note } : {}),
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };

    this.timesheets.set(id, ts);
    return ts;
  }

  submit(id: string): Timesheet {
    const ts = this.findById(id);
    if (ts.status !== 'draft') {
      throw new BadRequestException('Only draft timesheets can be submitted');
    }

    ts.status = 'submitted';
    ts.updatedAt = new Date().toISOString();

    this.timesheets.set(id, ts);
    return ts;
  }

  update(id: string, dto: UpdateTimesheetDto): Timesheet {
    const ts = this.findById(id);
    if (ts.status === 'approved-onchain') {
      throw new BadRequestException('Cannot edit a timesheet that has already been approved on-chain');
    }

    if (dto.hours !== undefined) ts.hours = dto.hours;
    if (dto.note !== undefined) ts.note = dto.note;
    ts.updatedAt = new Date().toISOString();

    this.timesheets.set(id, ts);
    return ts;
  }

  markPendingOnChain(id: string): Timesheet {
    const ts = this.findById(id);
    if (ts.status === 'approved-onchain') {
      throw new BadRequestException('Timesheet is already approved on-chain');
    }

    ts.status = 'pending-onchain';
    ts.updatedAt = new Date().toISOString();

    this.timesheets.set(id, ts);
    return ts;
  }

  recordOnChain(id: string, onchainTxHash: string): Timesheet {
    const ts = this.findById(id);
    if (!onchainTxHash) {
      throw new BadRequestException('Transaction hash is required to confirm on-chain approval');
    }

    ts.status = 'approved-onchain';
    ts.onchainTxHash = onchainTxHash;
    ts.updatedAt = new Date().toISOString();

    this.timesheets.set(id, ts);
    return ts;
  }

  reject(id: string, reason?: string): Timesheet {
    const ts = this.findById(id);
    if (ts.status === 'approved-onchain') {
      throw new BadRequestException('Cannot reject a timesheet that is already approved on-chain');
    }

    ts.status = 'rejected';
    if (reason) {
      ts.note = ts.note ? `${ts.note} (Rejection reason: ${reason})` : `Rejection reason: ${reason}`;
    }
    ts.updatedAt = new Date().toISOString();

    this.timesheets.set(id, ts);
    return ts;
  }
}
