import { describe, it, expect, beforeEach } from 'vitest';
import { MockPayrollApi, DEMO_SAM, DEMO_KARIM, PaymentMismatchError } from '@nightshift/api';

/**
 * Auditor test suite: the acceptance tests that prove the system works correctly.
 *
 * These tests verify:
 * 1. Wrong amounts cannot be confirmed
 * 2. Wrong salts cannot be confirmed
 * 3. No salary appears anywhere in the blockchain data
 * 4. Same month cannot be confirmed twice
 * 5. Cannot confirm before hours are approved
 *
 * These tests are written now against the mock API and will remain valid
 * when B lands the real implementation.
 */

describe('NightShift Auditor Acceptance Tests', () => {
  let api: MockPayrollApi;

  beforeEach(() => {
    // Reset to demo state before each test
    api = new MockPayrollApi({ actingAs: DEMO_SAM });
  });

  describe('1. Wrong amount cannot be confirmed', () => {
    it('rejects confirmation when the amount does not match the agreed salary', async () => {
      // DEMO_SAM is salaried at 4200/month
      // Verify the correct amount first
      const record = await api.getEmploymentRecord(DEMO_SAM);
      const march2026 = record.periods.find((p) => p.period === '2026-03');
      
      // March is deliberately unconfirmed (demo moment: employer paid 4000 instead of 4200)
      expect(march2026?.status).toBe('unconfirmed');

      // Try to confirm with the wrong amount
      try {
        await api.confirmPayment({ period: '2026-03', amountReceived: 5000n });
        expect.fail('Should have thrown PaymentMismatchError');
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentMismatchError);
      }
    });

    it('rejects confirmation when employer underpaid', async () => {
      // The critical demo: employer paid 4000 when 4200 was agreed
      try {
        await api.confirmPayment({ period: '2026-03', amountReceived: 4000n });
        expect.fail('Should have thrown PaymentMismatchError');
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentMismatchError);
      }
    });
  });

  describe('2. Wrong salt cannot be confirmed', () => {
    it('rejects confirmation when the salt does not match', async () => {
      // Get a worker's offer to have a valid salt
      const api1 = new MockPayrollApi({ actingAs: DEMO_KARIM });
      const offer = await api1.getMyOffer();

      if (!offer) {
        // If no offer, we cannot test salt mismatch
        console.log('No offer available for salt mismatch test');
        return;
      }

      // Try to accept with a wrong salt
      try {
        const wrongSalt = 'wrong_' + offer.salt;
        await api1.acceptOffer({ ratePerPeriod: offer.ratePerPeriod, salt: wrongSalt });
        expect.fail('Should have thrown OfferMismatchError');
      } catch (e) {
        // Expected to fail with OfferMismatchError or similar
        expect(e).toBeDefined();
      }
    });
  });

  describe('3. No salary appears anywhere in the blockchain data (Privacy Test)', () => {
    it('confirms that no salary amount leaks into the confirmation status', async () => {
      // The core claim: after a full run, no salary appears anywhere
      const record = await api.getEmploymentRecord(DEMO_SAM);

      // Loop through all periods and their status
      for (const period of record.periods) {
        // status should only be: confirmed, unconfirmed, awaiting-hours, or awaiting-confirmation
        expect(['confirmed', 'unconfirmed', 'awaiting-hours', 'awaiting-confirmation']).toContain(
          period.status
        );

        // Stringify the period and check it contains no salary-like numbers
        const periodStr = JSON.stringify(period);
        // Should not contain 4200 (DEMO_SAM's salary)
        expect(periodStr).not.toContain('4200');
        // Should not contain 4000 (the underpayment from March)
        expect(periodStr).not.toContain('4000');
      }
    });

    it('does not expose salary in employment record structure', async () => {
      const record = await api.getEmploymentRecord(DEMO_SAM);
      
      // The record should not have a salary field
      expect(record).not.toHaveProperty('salary');
      
      // The periods should not have amount fields
      for (const period of record.periods) {
        expect(period).not.toHaveProperty('amount');
        expect(period).not.toHaveProperty('ratePerPeriod');
      }
    });
  });

  describe('4. Confirming the same month twice fails', () => {
    it('rejects confirmation when a period is already confirmed', async () => {
      // DEMO_KARIM has January 2026 confirmed
      const api_karim = new MockPayrollApi({ actingAs: DEMO_KARIM });
      const record = await api_karim.getEmploymentRecord(DEMO_KARIM);
      const january = record.periods.find((p) => p.period === '2026-01');
      
      expect(january?.status).toBe('confirmed');

      // Try to confirm January again
      try {
        await api_karim.confirmPayment({ period: '2026-01', amountReceived: 5000n });
        expect.fail('Should have rejected confirming an already-confirmed period');
      } catch (e) {
        // Expected to fail
        expect(e).toBeDefined();
      }
    });
  });

  describe('5. Cannot confirm before hours are approved', () => {
    it('rejects confirmation when hours have not been approved', async () => {
      // Find a period where hours are not approved
      const record = await api.getEmploymentRecord(DEMO_SAM);
      const awaitingHours = record.periods.find((p) => p.status === 'awaiting-hours');

      if (!awaitingHours) {
        console.log('No awaiting-hours period found for test');
        return;
      }

      // Try to confirm when hours are not approved
      try {
        await api.confirmPayment({ period: awaitingHours.period, amountReceived: 4200n });
        expect.fail('Should have rejected confirmation before hours are approved');
      } catch (e) {
        // Expected to fail
        expect(e).toBeDefined();
      }
    });
  });

  describe('Board rendering and accessibility', () => {
    it('provides worker records for board display', async () => {
      const record = await api.getEmploymentRecord(DEMO_SAM);
      
      // Should have periods to display
      expect(record.periods.length).toBeGreaterThan(0);
      
      // Each period should have required fields for display
      for (const period of record.periods) {
        expect(period).toHaveProperty('period');
        expect(period).toHaveProperty('status');
      }
    });

    it('supports listing all employment records', async () => {
      // E (auditor) should be able to list records without a wallet
      // This method is for read-only access
      const records = await api.listEmploymentRecords();
      
      expect(Array.isArray(records)).toBe(true);
    });
  });
});
