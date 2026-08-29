import { describe, it, expect, beforeEach } from 'vitest';
import { DirectoryService } from '../src/directory/directory.service.js';
import { TimesheetsService } from '../src/timesheets/timesheets.service.js';
import { EmployerGuard } from '../src/auth/employer.guard.js';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

describe('NightShift Backend Verification Tests (Part 4 Plan)', () => {

  describe('1. Auth Security Guard (EmployerGuard)', () => {
    it('returns 401 UnauthorizedException when token is missing or unconfigured', () => {
      const guard = new EmployerGuard();
      
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('allows request when valid bearer token is provided', () => {
      process.env.EMPLOYER_API_TOKEN = 'test-token-123456';
      const guard = new EmployerGuard();

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Bearer test-token-123456' },
          }),
        }),
      } as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });

  describe('2. Directory Schema Privacy Protection', () => {
    it('guarantees DirectoryEntry contains NO salary fields', () => {
      const service = new DirectoryService();
      const entries = service.findAll();
      
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        const keys = Object.keys(entry);
        expect(keys).not.toContain('salary');
        expect(keys).not.toContain('rate');
        expect(keys).not.toContain('amount');
        expect(keys).not.toContain('salt');
        expect(keys).not.toContain('secret');
      }
    });
  });

  describe('3. Timesheet On-Chain Authority Boundary', () => {
    let service: TimesheetsService;

    beforeEach(() => {
      service = new TimesheetsService();
    });

    it('refuses to mark approved-onchain without a valid transaction hash', () => {
      const created = service.create({
        workerKey: '0x7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a',
        period: '2026-05',
        hours: 40,
      });

      expect(() => service.recordOnChain(created.id, '')).toThrow(BadRequestException);
    });

    it('successfully transitions to approved-onchain when tx hash is supplied', () => {
      const created = service.create({
        workerKey: '0x7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a',
        period: '2026-05',
        hours: 40,
      });

      const updated = service.recordOnChain(created.id, '0x9999999999999999999999999999999999999999999999999999999999999999');
      expect(updated.status).toBe('approved-onchain');
      expect(updated.onchainTxHash).toBe('0x9999999999999999999999999999999999999999999999999999999999999999');
    });
  });

  describe('4. IndexerClient Graceful Failure', () => {
    it('throws ServiceUnavailableException when the indexer is unreachable', async () => {
      // Point at a URL that will definitely refuse the connection
      process.env.INDEXER_URL = 'http://127.0.0.1:1/graphql';
      const { IndexerClient } = await import('../src/reporting/indexer.client.js');
      const client = new IndexerClient();

      await expect(
        client.query('{ __typename }'),
      ).rejects.toThrow(/[Uu]navailable|ECONNREFUSED|fetch failed/);
    });

    it('checkHealth returns false when the indexer is unreachable', async () => {
      process.env.INDEXER_URL = 'http://127.0.0.1:1/graphql';
      const { IndexerClient } = await import('../src/reporting/indexer.client.js');
      const client = new IndexerClient();

      const result = await client.checkHealth();
      expect(result).toBe(false);
    });
  });

});
