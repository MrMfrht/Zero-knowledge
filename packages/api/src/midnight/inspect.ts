#!/usr/bin/env node
/**
 * Read back the public ledger of a deployed payroll contract.
 *
 *   npx tsx src/midnight/inspect.ts <contract-address>
 *   npx tsx src/midnight/inspect.ts <contract-address> --network preprod
 *
 * This is the companion to `deploy.ts`, and it exists because "the deploy
 * script printed an address" is not evidence that anything landed. It goes
 * back out to the indexer, deserializes the state with the compiler-generated
 * `ledger()`, and prints what a chain observer would see.
 *
 * That last phrase is the point. Everything this prints is PUBLIC — it is
 * readable by anyone with the contract address and no permission of any kind.
 * If a value you expected to be hidden shows up here in the clear, that is a
 * privacy bug in the contract, not a bug in this script. The commitments are
 * supposed to look like noise; the counts and the keys are not hidden at all
 * (docs/midnight-privacy-model.md, facts 1 and 5).
 *
 * Read-only: no wallet, no keys, no proof server, no transaction.
 */
import { WebSocket } from 'ws';
// The indexer provider opens a GraphQL subscription even for a one-shot
// query, and Node has no global WebSocket (midnight-js skill §5).
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ledger } from './contract.js';
import type { NetworkId } from './network.js';
import { INDEXER_ENDPOINTS } from './network.js';

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/**
 * A Compact `Map` ledger field. Note `size()` is a method returning `bigint`,
 * not a `size` property — the generated bindings do not mimic JS `Map`
 * (`packages/contract/src/managed/contract/index.d.ts`).
 */
type LedgerMap<V> = Iterable<[Uint8Array, V]> & { size(): bigint };

function describeMap<V>(name: string, map: LedgerMap<V>): void {
  const size = map.size();
  console.log(`\n${name} (${size} ${size === 1n ? 'entry' : 'entries'})`);
  for (const [key, value] of map) {
    const shown = value instanceof Uint8Array ? toHex(value) : String(value);
    console.log(`  ${toHex(key)} -> ${shown}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const address = argv.find((a) => !a.startsWith('--'));
  if (!address) {
    console.error('usage: inspect.ts <contract-address> [--network undeployed|preprod|preview|mainnet]');
    process.exit(2);
  }
  const networkIndex = argv.indexOf('--network');
  const networkId = (networkIndex >= 0 ? argv[networkIndex + 1] : 'undeployed') as NetworkId;
  setNetworkId(networkId);

  const endpoints = INDEXER_ENDPOINTS[networkId];
  const publicDataProvider = indexerPublicDataProvider(endpoints.http, endpoints.ws);

  const contractState = await publicDataProvider.queryContractState(address);
  if (contractState === null) {
    console.error(`No contract at ${address} on ${networkId}. Wrong address, wrong network, or the indexer is behind.`);
    process.exit(1);
  }

  const state = ledger(contractState.data);

  console.log(`Contract ${address} on ${networkId}`);
  console.log('\n--- sealed at deployment, never changes ---');
  console.log(`employerKey     ${toHex(state.employerKey)}`);
  // Fresh per deployment on purpose: it is what stops one worker's dappKey
  // looking the same to two different employers. Two contracts sharing a
  // deploymentId would silently restore cross-employer linkability, so this
  // is worth eyeballing whenever a second contract goes up.
  console.log(`deploymentId    ${toHex(state.deploymentId)}`);
  console.log(`contributionRate ${state.contributionRate}%`);

  console.log('\n--- per-worker, public ---');
  // agreedRate holds persistentCommit(rate, salt), not the rate. It is
  // unreadable here by design; if these ever look like small numbers,
  // something is writing plaintext into a Map (privacy model, fact 1).
  describeMap('agreedRate (commitments — must look like noise)', state.agreedRate);
  describeMap('approvedHours', state.approvedHours);
  describeMap('contributionOk', state.contributionOk);
  describeMap('paidFor', state.paidFor);
  describeMap('active', state.active);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // The indexer subscription keeps the event loop alive otherwise — the
    // same handle leak deploy.ts documents at its own exit.
    process.exit(process.exitCode ?? 0);
  });
