import { Injectable } from '@nestjs/common';
import { IndexerClient } from './indexer.client.js';
import type { ReportSummary } from '../contracts/index.js';

const DEMO_KARIM = '0x7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a';
const DEMO_DANA  = '0x91b291b291b291b291b291b291b291b291b291b291b291b291b291b291b291b2';
const DEMO_SAM   = '0xc4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8';

@Injectable()
export class ReportingService {
  constructor(private readonly indexerClient: IndexerClient) {}

  async getSummary(): Promise<ReportSummary> {
    // In production, queries the Midnight GraphQL indexer for aggregated period states
    return {
      activeHeadcount: 3,
      totalConfirmedPeriods: 10,
      totalUnconfirmedPeriods: 1,
      contributionVerifiedCount: 9,
      generatedAt: new Date().toISOString(),
    };
  }

  async getUnconfirmedPeriods(): Promise<Array<{ workerKey: string; period: string; status: string; reason: string }>> {
    return [
      {
        workerKey: DEMO_SAM,
        period: '2026-03',
        status: 'unconfirmed',
        reason: 'Payment amount mismatch detected during ZK proof confirmation',
      },
    ];
  }

  async getHealthStatus(): Promise<{ status: string; indexerReachable: boolean }> {
    const indexerReachable = await this.indexerClient.checkHealth();
    return {
      status: 'ok',
      indexerReachable,
    };
  }
}
