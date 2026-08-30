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
 * address and it falls back to the mock. Which one you got comes back on the
 * returned `PayrollApiDescription`, and all three apps put it on screen — a
 * demo quietly running on fixtures is the worst outcome available here.
 */
import type { WorkerKey } from '@nightshift/shared';
import type { PayrollApi } from './PayrollApi.js';
import { MockPayrollApi } from './mock/MockPayrollApi.js';
import { MidnightPayrollApi } from './midnight/MidnightPayrollApi.js';
import { NETWORK_IDS, type NetworkId } from './midnight/network.js';
import { LOCAL_SECRET_STORAGE_KEY } from './midnight/localSecret.js';

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
  /**
   * Force this browser's device secret to a known value. **Local devnet only.**
   *
   * The whole product rests on this secret being generated on the device and
   * never travelling, so putting one in configuration is precisely the wrong
   * shape — `createPayrollApi` refuses it on any network but `undeployed`.
   *
   * It exists because a demo needs the worker app to *be* the worker the
   * headless scripts hired, and a browser that just generated its own fresh
   * secret is correctly a stranger to that contract: it shows an empty
   * history, which looks like a bug and is not. The alternative is hiring
   * from the employer app, which needs a wallet extension to sign.
   */
  readonly devSeedDeviceSecretHex?: string | undefined;
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

  return {
    contractAddress,
    networkId: networkId as NetworkId | undefined,
    devSeedDeviceSecretHex: asNonEmptyString(env.VITE_DEV_DEVICE_SECRET),
  };
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

  const seed = asNonEmptyString(config.devSeedDeviceSecretHex);
  if (seed) {
    if (networkId !== 'undeployed') {
      throw new Error(
        `VITE_DEV_DEVICE_SECRET is set while pointing at "${networkId}". It overwrites this ` +
          "browser's device secret — the one value the entire privacy model depends on being " +
          'generated locally and never shared. It is permitted only against a throwaway local ' +
          'devnet. Remove it, or point at undeployed.',
      );
    }
    if (!/^[0-9a-fA-F]{64}$/.test(seed)) {
      throw new Error('VITE_DEV_DEVICE_SECRET must be exactly 64 hex characters (32 bytes).');
    }
    // Deliberately overwrites: the point is to make this browser be a
    // specific worker, and honouring an existing secret would mean the flag
    // silently did nothing on the second page load.
    window.localStorage.setItem(LOCAL_SECRET_STORAGE_KEY, seed.toLowerCase());
    console.warn(
      'VITE_DEV_DEVICE_SECRET overwrote this device secret. Devnet only — never set this ' +
        'anywhere real.',
    );
  }

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
