import { describe, expect, it, vi } from 'vitest';
import type { BalancingRecipe, WalletFacade } from '@midnight-ntwrk/wallet-sdk';
import { submitAndConfirm } from './transactions.js';

/** Minimal fake covering only what submitAndConfirm calls. */
function fakeWallet(overrides: Partial<WalletFacade> = {}): WalletFacade {
  return {
    finalizeRecipe: vi.fn().mockResolvedValue({}),
    submitTransaction: vi.fn().mockResolvedValue('tx-123'),
    revert: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as WalletFacade;
}

const recipe = {} as BalancingRecipe;

describe('submitAndConfirm', () => {
  it('returns the txId without confirmation when none is requested', async () => {
    const wallet = fakeWallet();

    const result = await submitAndConfirm(wallet, recipe);

    expect(result).toEqual({ txId: 'tx-123', confirmation: undefined });
    expect(wallet.revert).not.toHaveBeenCalled();
  });

  it('waits for and returns the caller-supplied confirmation', async () => {
    const wallet = fakeWallet();

    const result = await submitAndConfirm(wallet, recipe, {
      waitForConfirmation: async (txId) => `confirmed:${txId}`,
    });

    expect(result).toEqual({ txId: 'tx-123', confirmation: 'confirmed:tx-123' });
    expect(wallet.revert).not.toHaveBeenCalled();
  });

  it('reverts and rethrows when finalizeRecipe fails', async () => {
    const boom = new Error('finalize failed');
    const wallet = fakeWallet({ finalizeRecipe: vi.fn().mockRejectedValue(boom) });

    await expect(submitAndConfirm(wallet, recipe)).rejects.toThrow(boom);
    expect(wallet.revert).toHaveBeenCalledWith(recipe);
  });

  it('reverts and rethrows when submitTransaction fails', async () => {
    const boom = new Error('submit failed');
    const wallet = fakeWallet({ submitTransaction: vi.fn().mockRejectedValue(boom) });

    await expect(submitAndConfirm(wallet, recipe)).rejects.toThrow(boom);
    expect(wallet.revert).toHaveBeenCalledWith(recipe);
  });

  it('reverts and rethrows when confirmation never arrives (timeout)', async () => {
    const wallet = fakeWallet();
    const neverResolves = new Promise<string>(() => {});

    await expect(
      submitAndConfirm(wallet, recipe, {
        waitForConfirmation: () => neverResolves,
        confirmTimeoutMs: 10,
      }),
    ).rejects.toThrow(/not be confirmed|not confirmed/i);
    expect(wallet.revert).toHaveBeenCalledWith(recipe);
  });

  it('reverts and rethrows when waitForConfirmation itself throws', async () => {
    const boom = new Error('circuit rejected');
    const wallet = fakeWallet();

    await expect(
      submitAndConfirm(wallet, recipe, {
        waitForConfirmation: async () => {
          throw boom;
        },
      }),
    ).rejects.toThrow(boom);
    expect(wallet.revert).toHaveBeenCalledWith(recipe);
  });

  it('does not let a failing revert() mask the original error', async () => {
    const original = new Error('submit failed');
    const wallet = fakeWallet({
      submitTransaction: vi.fn().mockRejectedValue(original),
      revert: vi.fn().mockRejectedValue(new Error('revert also failed')),
    });

    await expect(submitAndConfirm(wallet, recipe)).rejects.toThrow(original);
  });
});
