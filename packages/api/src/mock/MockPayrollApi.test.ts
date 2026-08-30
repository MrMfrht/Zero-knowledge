import { beforeEach, describe, expect, it } from 'vitest';
import type { TransactionStatus } from '../PayrollApi.js';
import { DEMO_EMPLOYER, DEMO_KARIM, MockPayrollApi, resetMockStore } from './MockPayrollApi.js';

beforeEach(() => {
  resetMockStore();
});

function api(): MockPayrollApi {
  return new MockPayrollApi({ actingAs: DEMO_EMPLOYER, latencyMs: 0 });
}

describe('MockPayrollApi — wallet', () => {
  it('starts disconnected', async () => {
    await expect(api().getWalletStatus()).resolves.toEqual({ connected: false });
  });

  it('connects and disconnects', async () => {
    const client = api();
    const connected = await client.connectWallet();
    expect(connected.connected).toBe(true);

    await client.disconnectWallet();
    await expect(client.getWalletStatus()).resolves.toEqual({ connected: false });
  });

  it('payWorker requires a connected wallet', async () => {
    const client = api();
    await expect(
      client.payWorker({ workerKey: DEMO_KARIM, amount: 5000n }),
    ).rejects.toThrow('No wallet connected');
  });

  it('payWorker succeeds once a wallet is connected', async () => {
    const client = api();
    await client.connectWallet();
    const result = await client.payWorker({ workerKey: DEMO_KARIM, amount: 5000n });
    expect(result.txId).toMatch(/^0x[0-9a-f]{40}$/);
  });
});

describe('MockPayrollApi — transaction lifecycle', () => {
  it('reports the full signing→proving→submitting→pending→confirmed sequence', async () => {
    const client = api();
    const stages: TransactionStatus['stage'][] = [];

    await client.hire({
      workerKey: DEMO_KARIM,
      ratePerPeriod: 5000n,
      expectedHours: 1,
      onStatus: (s) => stages.push(s.stage),
    });

    expect(stages).toEqual(['signing', 'proving', 'submitting', 'pending', 'confirmed']);
  });

  it('omitting onStatus changes nothing about the resolved value', async () => {
    const client = api();
    const offer = await client.hire({ workerKey: DEMO_KARIM, ratePerPeriod: 5000n, expectedHours: 1 });
    expect(offer.workerKey).toBe(DEMO_KARIM);
  });

  it('reports "failed" and rethrows when the underlying call throws', async () => {
    const client = api();
    const stages: TransactionStatus['stage'][] = [];

    await expect(
      client.approveHours({
        workerKey: '0xdoes-not-exist',
        period: '2026-01',
        hours: 1,
        onStatus: (s) => stages.push(s.stage),
      }),
    ).rejects.toThrow();

    expect(stages.at(-1)).toBe('failed');
  });
});
