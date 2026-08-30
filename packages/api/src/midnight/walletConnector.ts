/**
 * Browser wallet connection via the DApp Connector API.
 *
 * This is the ONLY place `MidnightPayrollApi` talks to a wallet extension —
 * `connectWallet`/`disconnectWallet`/`getWalletStatus` on the real
 * implementation call into here, never into `@midnight-ntwrk/*` directly
 * from elsewhere in this package.
 *
 * Reference: `.agents/skills/react-wallet-connector/SKILL.md`, and the React
 * wallet connector guide at docs.midnight.network/guides/react-wallet-connect.
 */
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { WalletStatus } from '../PayrollApi.js';

// The package ships this same augmentation (`dist/globals.d.ts`), but it did
// not merge reliably across this project's `moduleResolution: "NodeNext"` +
// workspace setup from a bare side-effect import. Declaring it directly here
// is redundant with, not in conflict with, the package's own declaration —
// TypeScript merges compatible `declare global` interfaces from any number
// of files.
declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

/**
 * Wallets inject themselves onto `window.midnight` keyed by a UUID that
 * differs per install — never assume a fixed key like `window.midnight.lace`.
 * See the troubleshooting table in the skill: this is the #1 cause of
 * "No Midnight wallet found" when a wallet is actually installed.
 */
export function listInjectedWallets(): InitialAPI[] {
  const injected = window.midnight;
  return injected ? Object.values(injected) : [];
}

export class NoWalletFoundError extends Error {
  constructor() {
    super('No Midnight wallet found. Install a Midnight wallet extension (Lace, 1AM, ...) and refresh.');
    this.name = 'NoWalletFoundError';
  }
}

/**
 * Picks the first injected wallet. Fine while NightShift only expects one
 * wallet installed; swap for a picker UI (see the skill's §17) the moment
 * more than one shows up in a demo machine.
 */
function selectWallet(): InitialAPI {
  const wallets = listInjectedWallets();
  if (wallets.length === 0) throw new NoWalletFoundError();
  return wallets[0];
}

/**
 * A live connection plus the address the rest of the app cares about.
 * `connectedApi` stays inside `packages/api/src/midnight/` — nothing outside
 * this file ever touches it directly.
 */
export interface WalletConnection {
  connectedApi: ConnectedAPI;
  status: WalletStatus;
}

/**
 * Prompts the wallet extension to connect on the given network. The
 * extension shows its own authorization UI; this resolves once the person
 * approves (or throws if they decline or none is installed).
 *
 * @param networkId Must match the wallet's own configured network — a
 *   mismatch here is the "connection rejected" failure the skill documents,
 *   not a bug in this code.
 */
export async function connectWallet(
  networkId: 'undeployed' | 'preview' | 'preprod' | 'mainnet',
): Promise<WalletConnection> {
  const wallet = selectWallet();
  const connectedApi = await wallet.connect(networkId);

  const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
  const connectionStatus = await connectedApi.getConnectionStatus();

  if (connectionStatus.status !== 'connected') {
    throw new Error(`Wallet connection did not complete (status: ${connectionStatus.status}).`);
  }

  return {
    connectedApi,
    status: { connected: true, address: unshieldedAddress },
  };
}
