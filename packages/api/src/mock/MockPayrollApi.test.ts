import { beforeEach, describe, expect, it } from 'vitest';
import type { TransactionStatus } from '../PayrollApi.js';
import { ContributionMismatchError, PaymentMismatchError } from '../errors.js';
import {
  DEMO_EMPLOYER,
  DEMO_KARIM,
  DEMO_SHIELDED_ADDRESSES,
  MockPayrollApi,
  resetMockStore,
} from './MockPayrollApi.js';

beforeEach(() => {
  resetMockStore();
});

function api(): MockPayrollApi {
  return new MockPayrollApi({ actingAs: DEMO_EMPLOYER, latencyMs: 0 });
}

function asWorker(key: string): MockPayrollApi {
  return new MockPayrollApi({ actingAs: key, latencyMs: 0 });
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

  const karimAddress = DEMO_SHIELDED_ADDRESSES[DEMO_KARIM]!;

  it('payWorker requires a connected wallet', async () => {
    const client = api();
    await expect(
      client.payWorker({
        workerKey: DEMO_KARIM,
        recipientShieldedAddress: karimAddress,
        amount: 5000n,
      }),
    ).rejects.toThrow('No wallet connected');
  });

  it('payWorker succeeds once a wallet is connected', async () => {
    const client = api();
    await client.connectWallet();
    const result = await client.payWorker({
      workerKey: DEMO_KARIM,
      recipientShieldedAddress: karimAddress,
      amount: 5000n,
    });
    expect(result.txId).toMatch(/^0x[0-9a-f]{40}$/);
  });

  // A worker key is an identity inside the contract, not a place funds can go.
  // Sending to one would silently fail against a real wallet, so the mock
  // refuses an empty recipient rather than pretending the payment happened.
  it('payWorker refuses an empty shielded address', async () => {
    const client = api();
    await client.connectWallet();
    await expect(
      client.payWorker({
        workerKey: DEMO_KARIM,
        recipientShieldedAddress: '   ',
        amount: 5000n,
      }),
    ).rejects.toThrow(/shielded address is required/i);
  });

  it('getMyShieldedAddress needs a wallet, then returns the address', async () => {
    const karim = asWorker(DEMO_KARIM);
    await expect(karim.getMyShieldedAddress()).rejects.toThrow(/Connect a wallet/i);
    await karim.connectWallet();
    await expect(karim.getMyShieldedAddress()).resolves.toBe(karimAddress);
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

// These mirror rules the Compact contract enforces. They exist so the mock and
// the chain cannot drift apart: an app built against the mock must not discover
// a new failure the first time it talks to a real contract.
describe('MockPayrollApi — the rules the contract also enforces', () => {
  // One hourly worker, hired and paid from scratch, with numbers chosen so
  // "earnings" and "the bare rate" give obviously different answers:
  // 40 hours × 100 = 4000 earned; 25% of that is 1000, while 25% of the rate
  // alone would be 25.
  const HOURLY_WORKER = `0x${'ab'.repeat(32)}`;
  const RATE = 100n;
  const HOURS = 40;
  const PERIOD = '2026-05';

  async function hireAndApprove(): Promise<MockPayrollApi> {
    const employer = api();
    const offer = await employer.hire({
      workerKey: HOURLY_WORKER,
      ratePerPeriod: RATE,
      expectedHours: HOURS,
    });
    const worker = asWorker(HOURLY_WORKER);
    await worker.acceptOffer({ ratePerPeriod: offer.ratePerPeriod, salt: offer.salt });
    await employer.approveHours({ workerKey: HOURLY_WORKER, period: PERIOD, hours: HOURS });
    return worker;
  }

  it('rejects a payment that does not equal hours × the sealed rate', async () => {
    const worker = await hireAndApprove();
    await expect(
      worker.confirmPayment({ period: PERIOD, amountReceived: 3000n }),
    ).rejects.toThrow(PaymentMismatchError);
  });

  it('accepts the payment that does equal hours × the sealed rate', async () => {
    const worker = await hireAndApprove();
    await expect(
      worker.confirmPayment({ period: PERIOD, amountReceived: 4000n }),
    ).resolves.toBeUndefined();
  });

  it('checks contributions against real earnings, not the bare rate', async () => {
    const worker = await hireAndApprove();

    // 25% of the rate alone — what the old, wrong formula accepted.
    await expect(
      worker.proveContribution({ period: PERIOD, declared: 25n }),
    ).rejects.toThrow(ContributionMismatchError);

    // 25% of what was actually earned.
    await expect(
      worker.proveContribution({ period: PERIOD, declared: 1000n }),
    ).resolves.toBeUndefined();
  });

  it('refuses to re-approve a period that already has approved hours', async () => {
    // Write-once. Otherwise an employer could underpay, then rewrite the hours
    // confirmPayment anchors to, and have the shortfall recorded as correct.
    await expect(
      api().approveHours({ workerKey: DEMO_KARIM, period: '2026-04', hours: 99 }),
    ).rejects.toThrow(/already been approved/);
  });

  it('refuses to confirm the same period twice', async () => {
    // 2026-04 is already confirmed for Karim in the seeded data.
    await expect(
      asWorker(DEMO_KARIM).confirmPayment({ period: '2026-04', amountReceived: 5000n }),
    ).rejects.toThrow(/already been confirmed/);
  });

  it('refuses to approve hours for a worker whose employment has ended', async () => {
    const employer = api();
    await employer.endEmployment(DEMO_KARIM);
    await expect(
      employer.approveHours({ workerKey: DEMO_KARIM, period: '2026-05', hours: 1 }),
    ).rejects.toThrow(/employment has ended/);
  });
});
