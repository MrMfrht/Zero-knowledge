#!/usr/bin/env node
/**
 * The whole employment lifecycle, driven through the REAL
 * `MidnightPayrollApi` against a real chain.
 *
 *   npx tsx src/midnight/demo-lifecycle.ts --contract <address>
 *
 * `smoke.mjs` already proves the contract enforces this sequence, but it runs
 * the circuits directly in-process. This runs them the way the apps will:
 * through the api, over the indexer, with real ZK proofs from the proof
 * server and real transactions on the node. Different things break at that
 * level, which is the point.
 *
 * Deploy a fresh contract first — the sequence is one-shot per worker, so a
 * second run against the same contract will correctly refuse to re-hire:
 *
 *   npx tsx src/midnight/deploy.ts --contribution-pct 25
 *   npx tsx src/midnight/demo-lifecycle.ts --contract <the address it prints>
 *
 * NOT covered here: `payWorker`. It moves real funds through the browser
 * wallet's `sendPrivatePayment`, which needs a `ConnectedAPI` that only
 * exists in a page with an extension. `confirmPayment` below is the worker
 * asserting an amount arrived; nothing in this script actually transfers it.
 * That gap is real and is called out rather than papered over.
 */
import { fileURLToPath } from 'node:url';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { createHeadlessWallet, type HeadlessWallet } from './headlessWallet.js';
import { MidnightPayrollApi } from './MidnightPayrollApi.js';
import { LOCAL_SECRET_STORAGE_KEY } from './localSecret.js';
import type { PayrollProviders } from './providers.js';
import { INDEXER_ENDPOINTS, type NetworkId } from './network.js';

/**
 * A `Storage` that lives and dies with the process, holding one known secret.
 *
 * The contract derives every identity from this secret, so seeding it is what
 * makes a run "be" the employer or the worker. In the apps this is the
 * browser's `localStorage`; in Node it must not persist, because a secret
 * written to disk by a demo is a secret nobody remembers to delete.
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

function reportStatus(label: string) {
  return (s: { stage: string; txId?: string }) =>
    console.log(`  ${label}: [${s.stage}]${s.txId ? ` txId=${s.txId.slice(0, 16)}...` : ''}`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const get = (flag: string, fallback?: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : fallback;
  };

  const contractAddress = get('--contract');
  if (!contractAddress) {
    console.error('usage: demo-lifecycle.ts --contract <address> [--rate 5000] [--period 2026-04]');
    process.exit(2);
  }
  const networkId = get('--network', 'undeployed') as NetworkId;
  // Hourly by default (85/h x 160h), because hours != 1 is what catches the
  // mistake this script was first written with: the contract pays
  // `hours * rate`, not `rate`. A salaried worker is the same circuit with
  // hours = 1 and rate = the monthly salary, which is how smoke.mjs runs it.
  const ratePerPeriod = BigInt(get('--rate', '85')!);
  const period = get('--period', '2026-04')!;
  const hours = Number(get('--hours', '160'));
  const contributionPct = BigInt(get('--contribution-pct', '25')!);
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
    const zkConfigPath = get('--zk-path', fileURLToPath(new URL('../../../contract/src/managed', import.meta.url)))!;
    const zkConfigProvider = new NodeZkConfigProvider<never>(zkConfigPath);

    /**
     * One provider set per identity, with a DISTINCT private-state store.
     *
     * They must not share one. `acceptOffer` writes the agreed rate and salt
     * into private state and `confirmPayment` reads them back; a shared store
     * would have the employer's private state overwrite the worker's, and the
     * failure would look like a missing-witness bug rather than a wiring one.
     *
     * The single wallet is shared on purpose — it only pays fees. Identity
     * comes from the device secret, never from the wallet key, which is the
     * whole point of `dappKey(localSk(), deploymentId)`.
     */
    const providersFor = (who: string, w: HeadlessWallet): PayrollProviders =>
      ({
        privateStateProvider: levelPrivateStateProvider({
          privateStateStoreName: `payroll-private-state-${who}`,
          accountId: `${w.address}:${who}`,
          privateStoragePasswordProvider: () =>
            process.env.NIGHTSHIFT_PRIVATE_STORE_PASSWORD ?? 'Nightshift-Local-Devnet-9',
        }),
        publicDataProvider: indexerPublicDataProvider(endpoints.http, endpoints.ws),
        zkConfigProvider,
        proofProvider: httpClientProofProvider(proofServerUri, zkConfigProvider),
        walletProvider: w.walletAndMidnightProvider,
        midnightProvider: w.walletAndMidnightProvider,
      }) as unknown as PayrollProviders;

    const employer = new MidnightPayrollApi({
      contractAddress,
      networkId,
      // deploy.ts seals `employerKey` from the first 32 bytes of this seed.
      storage: storageHolding(seedHex.slice(0, 64)),
    });
    await employer.connectWithProviders(providersFor('employer', wallet));

    const worker = new MidnightPayrollApi({
      contractAddress,
      networkId,
      storage: storageHolding(get('--worker-secret', 'a'.repeat(64))!),
    });
    await worker.connectWithProviders(providersFor('worker', wallet));

    const workerKey = await worker.getMyKey();
    console.log(`\nEmployer: ${await employer.getMyKey()}`);
    console.log(`Worker:   ${workerKey}`);

    // 1 — hire. The rate goes on chain only as persistentCommit(rate, salt).
    console.log(`\n1. hire — ${ratePerPeriod}/period, ${hours}h expected`);
    const offer = await employer.hire({
      workerKey,
      ratePerPeriod,
      expectedHours: hours,
      onStatus: reportStatus('hire'),
    });
    console.log(`   commitment on chain: ${offer.commitment.slice(0, 20)}...`);

    // 2 — accept. The worker opens the commitment with the rate and salt the
    // employer sent them off-chain. Getting either wrong is rejected by the
    // circuit, which is what protects a worker from a lying employer.
    console.log('\n2. acceptOffer — worker opens the sealed rate');
    await worker.acceptOffer({ ratePerPeriod: offer.ratePerPeriod, salt: offer.salt });
    console.log('   accepted');

    // 3 — approve hours. Only the employer may; the circuit enforces it.
    console.log(`\n3. approveHours — ${period}, ${hours}h`);
    await employer.approveHours({ workerKey, period, hours, onStatus: reportStatus('approveHours') });

    // Reading that back is not a nicety — it is the test for `periodKey.ts`.
    // The api reimplements the contract's `periodKey` hash in TypeScript
    // (the circuit is not exported), and a wrong byte encoding would not
    // throw: every period lookup would just find nothing, and every worker
    // would look like they had never been employed. The period we just wrote
    // is the one thing we know is on chain, so it is the honest probe.
    const afterApproval = await employer.getEmploymentRecord(workerKey);
    const approved = afterApproval.periods.find((p) => p.period === period);
    if (!approved) {
      throw new Error(
        `periodKey mismatch: approveHours wrote ${period} to the chain, but reading the ` +
          `record back found ${afterApproval.periods.length} period(s) and not that one. ` +
          'The TypeScript periodKey in periodKey.ts no longer matches the contract.',
      );
    }
    console.log(`   read back: ${approved.period} ${approved.hours}h [${approved.status}]`);

    // 4 — confirm payment. The worker asserts what arrived; a mismatch is
    // refused, and the amount itself never reaches the ledger.
    //
    // `hours * rate`, not `rate`. The circuit reads `hours` from the ledger
    // where the EMPLOYER put it, exactly so the worker cannot inflate it — so
    // the api's `ratePerPeriod` is a unit rate and the payment is the product.
    // Passing the rate alone here failed with PaymentMismatchError, which is
    // the contract being right.
    //
    // No transfer has actually happened: payWorker needs a browser wallet
    // (see the file header). This confirms against the agreed rate only.
    const earnings = BigInt(hours) * ratePerPeriod;
    console.log(`\n4. confirmPayment — ${earnings} (${hours}h x ${ratePerPeriod}) for ${period}`);
    await worker.confirmPayment({ period, amountReceived: earnings });
    console.log('   confirmed');

    // 5 — prove the social-security contribution without revealing earnings.
    // `declared` stays private; only the pass/fail lands on chain. The circuit
    // checks `declared * 100 == hours * rate * contributionRate`, written as a
    // cross-multiplication because Compact has no division operator — so this
    // division must land exactly or the assertion fails.
    const declared = (earnings * contributionPct) / 100n;
    console.log(`\n5. proveContribution — ${declared} (${contributionPct}% of ${earnings})`);
    await worker.proveContribution({ period, declared });
    console.log('   contribution proven');

    // 6 — end employment. History stays; only `active` flips.
    console.log('\n6. endEmployment');
    await employer.endEmployment(workerKey);

    const record = await employer.getEmploymentRecord(workerKey);
    console.log(`\nFinal record: active=${record.active}, periods=${record.periods.length}`);
    for (const p of record.periods) {
      console.log(`  ${p.period}: ${p.hours}h [${p.status}] contribution=${p.contributionVerified}`);
    }
    console.log('Run inspect.ts against this contract to see the public ledger.');
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
