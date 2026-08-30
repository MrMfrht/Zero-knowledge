/**
 * Choose between the real chain and the in-memory mock, in one place.
 *
 * Every app needs this decision and none of them should own it. Three copies
 * of "read an env var, pick a class" is three chances to configure the demo
 * differently from the thing being demoed, and the failure would show up as
 * "the employer app can see workers the worker app cannot".
 *
 * The rule is deliberately blunt: **a contract address means the real chain.**
 * There is no `USE_MOCK` flag to leave in the wrong position. If you have
 * pointed an app at a deployed contract, that is what it talks to; remove the
 * address and it falls back to the mock. Which one you got is reported by
 * `describePayrollApi`, and the apps put that on screen — a demo that is
 * quietly running on fixtures is the worst outcome available here.
 */
import type { WorkerKey } from '@nightshift/shared';
import type { PayrollApi } from './PayrollApi.js';
import { MockPayrollApi } from './mock/MockPayrollApi.js';
import { MidnightPayrollApi } from './midnight/MidnightPayrollApi.js';
import { NETWORK_IDS, type NetworkId } from './midnight/network.js';

export interface PayrollApiConfig {
  /**
   * The deployed contract, from `deploy.ts`. Absent or empty means the mock.
   */
  readonly contractAddress?: string | undefined;
  /** Defaults to `undeployed`, the local devnet in `docker/compose.yml`. */
  readonly networkId?: NetworkId | undefined;
  /**
   * Mock only, and ignored against a real contract. On chain there is no
   * "act as" — identity is `dappKey(localSk(), deploymentId)`, derived from a
   * secret this browser holds and no configuration can override. That is the
   * point of the design, so the mock's demo personas simply do not apply.
   */
  readonly actingAs?: WorkerKey | undefined;
}

/** What was actually built, for the app to show the user. */
export interface PayrollApiDescription {
  readonly api: PayrollApi;
  readonly live: boolean;
  /** One line, safe to render: "chain: undeployed 3f2a…" or "mock data". */
  readonly label: string;
}

/**
 * Parse the config out of Vite's `import.meta.env`.
 *
 * Takes the env rather than reading `import.meta.env` directly, because this
 * package is also loaded by Node tooling (`deploy.ts`, `inspect.ts`,
 * `demo-lifecycle.ts`) where that object does not exist. Each app passes its
 * own; the parsing and the validation live here once.
 *
 * `.env.local` in an app directory:
 *
 *     VITE_CONTRACT_ADDRESS=d2e8d3be…e18a851e
 *     VITE_NETWORK_ID=undeployed
 */
export function payrollApiConfigFromEnv(env: Record<string, unknown>): PayrollApiConfig {
  const contractAddress = asNonEmptyString(env.VITE_CONTRACT_ADDRESS);
  const networkId = asNonEmptyString(env.VITE_NETWORK_ID);

  if (networkId && !NETWORK_IDS.includes(networkId as NetworkId)) {
    throw new Error(
      `VITE_NETWORK_ID is "${networkId}", which is not a Midnight network. ` +
        `Expected one of: ${NETWORK_IDS.join(', ')}.`,
    );
  }

  return { contractAddress, networkId: networkId as NetworkId | undefined };
}

export function createPayrollApi(config: PayrollApiConfig = {}): PayrollApiDescription {
  const contractAddress = asNonEmptyString(config.contractAddress);
  if (!contractAddress) {
    if (!config.actingAs) {
      throw new Error(
        'createPayrollApi needs either a contractAddress (to talk to a real contract) or ' +
          'an actingAs persona (to fall back to the mock). It was given neither, so there ' +
          'is no way to say who this app is.',
      );
    }
    return {
      api: new MockPayrollApi({ actingAs: config.actingAs }),
      live: false,
      label: 'mock data',
    };
  }

  const networkId = config.networkId ?? 'undeployed';
  return {
    api: new MidnightPayrollApi({ contractAddress, networkId }),
    live: true,
    // Truncated because the full address is 64 hex characters and this goes
    // in a header. It is public either way — nothing is being hidden.
    label: `chain: ${networkId} ${contractAddress.slice(0, 8)}…`,
  };
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}
