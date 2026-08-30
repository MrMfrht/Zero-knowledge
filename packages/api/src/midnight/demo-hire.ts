#!/usr/bin/env node
/**
 * Call `hire` on a deployed contract through the REAL `MidnightPayrollApi`.
 *
 *   npx tsx src/midnight/demo-hire.ts --contract <address>
 *
 * The point is what it exercises, not what it prints. `deploy.ts` proved the
 * plumbing — wallet, DUST, proving, submission — but it called
 * `deployContract` directly and never touched `MidnightPayrollApi`. This is
 * the first thing that drives a circuit through the class the three apps will
 * actually use, which until now had never run anywhere.
 *
 * Requires the local devnet (`docker compose -f docker/compose.yml up -d`)
 * and a contract address from `deploy.ts`.
 */
import { fileURLToPath } from 'node:url';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { createHeadlessWallet } from './headlessWallet.js';
import { MidnightPayrollApi } from './MidnightPayrollApi.js';
import { LOCAL_SECRET_STORAGE_KEY } from './localSecret.js';
import type { PayrollProviders } from './providers.js';
import { INDEXER_ENDPOINTS, type NetworkId } from './network.js';

/**
 * A `Storage` that lives and dies with the process, pre-seeded with a known
 * secret.
 *
 * `MidnightPayrollApi` keeps this device's 32-byte secret here. In the apps
 * that is the browser's `localStorage`; in Node it must be something that does
 * NOT persist, because a secret written to disk by a demo script is a secret
 * nobody remembers to delete.
 *
 * Seeding it is the whole trick: the contract derives every identity from this
 * secret, so an unseeded run is nobody. The first attempt at this script used
 * a random one and the contract correctly threw it out with "only the employer
 * may hire" — the authentication rule working exactly as designed.
 */
function storageHolding(secretHex: string): Storage {
  const map = new Map<string, string>([[LOCAL_SECRET_STORAGE_KEY, secretHex]]);
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const get = (flag: string, fallback?: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : fallback;
  };

  const contractAddress = get('--contract');
  if (!contractAddress) {
    console.error('usage: demo-hire.ts --contract <address> [--rate 5000] [--hours 160]');
    process.exit(2);
  }
  const networkId = get('--network', 'undeployed') as NetworkId;
  const ratePerPeriod = BigInt(get('--rate', '5000')!);
  const expectedHours = Number(get('--hours', '160'));
  const proofServerUri = get('--proof-server', 'http://127.0.0.1:6300')!;
  const endpoints = INDEXER_ENDPOINTS[networkId];
  const seedHex = get('--seed', '0000000000000000000000000000000000000000000000000000000000000001')!;

  const wallet = await createHeadlessWallet({
    networkId,
    seedHex,
    indexerUri: get('--indexer', endpoints.http)!,
    indexerWsUri: get('--indexer-ws', endpoints.ws)!,
    nodeUri: get('--node', 'http://127.0.0.1:9944')!,
    nodeWsUri: get('--node-ws', 'ws://127.0.0.1:9944')!,
    proofServerUri,
  });

  try {
    // Same base path rule as deploy.ts: must directly contain keys/ and zkir/.
    // `fileURLToPath`, not `.pathname` — the latter yields "/C:/Users/..." on
    // Windows, with a leading slash `fs` cannot open.
    const zkConfigPath = get('--zk-path', fileURLToPath(new URL('../../../contract/src/managed', import.meta.url)))!;
    const zkConfigProvider = new NodeZkConfigProvider<never>(zkConfigPath);

    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: 'payroll-private-state',
        accountId: wallet.address,
        // Devnet-only, same policy as deploy.ts: 16+ chars and 3 of 4
        // character classes, or the SDK refuses to open the store.
        privateStoragePasswordProvider: () =>
          process.env.NIGHTSHIFT_PRIVATE_STORE_PASSWORD ?? 'Nightshift-Local-Devnet-9',
      }),
      publicDataProvider: indexerPublicDataProvider(endpoints.http, endpoints.ws),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(proofServerUri, zkConfigProvider),
      walletProvider: wallet.walletAndMidnightProvider,
      midnightProvider: wallet.walletAndMidnightProvider,
    } as unknown as PayrollProviders;

    // Two identities, two api instances — because that is the real shape.
    // The employer's secret is the one the contract sealed as `employerKey` at
    // deploy time (deploy.ts takes the first 32 bytes of the same seed); the
    // worker's belongs to a separate device the employer never sees.
    const employerApi = new MidnightPayrollApi({
      contractAddress,
      networkId,
      storage: storageHolding(seedHex.slice(0, 64)),
    });
    await employerApi.connectWithProviders(providers);

    // Fixed rather than random so repeated runs address the same worker. A
    // real worker's secret is generated once, on their own device.
    const workerApi = new MidnightPayrollApi({
      contractAddress,
      networkId,
      storage: storageHolding(get('--worker-secret', 'a'.repeat(64))!),
    });

    // `getMyKey` reads `deploymentId` off the chain and hashes the device
    // secret with it, so one person gets an unrelated key from every employer.
    // Exercising that read path is half the value of this script.
    const workerKey = await workerApi.getMyKey();
    const employerKey = await employerApi.getMyKey();
    console.log(`\nEmployer key: ${employerKey}`);
    console.log(`Worker key:   ${workerKey}`);

    console.log(`\nHiring at ${ratePerPeriod}/period, ${expectedHours}h expected...`);
    const offer = await employerApi.hire({
      workerKey,
      ratePerPeriod,
      expectedHours,
      onStatus: (s) => console.log(`  [${s.stage}]${'txId' in s && s.txId ? ` txId=${s.txId}` : ''}`),
    });

    console.log('\nHired. What the employer must now hand to the worker:');
    console.log(`  commitment (on chain): ${offer.commitment}`);
    // The rate and salt are what open that commitment. They are returned here
    // and never written to the ledger — printing them is safe only because this
    // is a throwaway devnet. A_docs/06 questions 1 and 2 are precisely that
    // nothing yet carries these to the worker safely.
    console.log(`  rate + salt (must reach the worker OFF chain): ${offer.ratePerPeriod}, ${offer.salt}`);

    console.log('\nReading it back as a chain observer would:');
    const record = await employerApi.getEmploymentRecord(workerKey);
    console.log(`  active=${record.active} periods=${record.periods.length}`);
  } finally {
    await wallet.stop();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Indexer WS subscriptions keep the event loop alive otherwise.
    process.exit(process.exitCode ?? 0);
  });
