#!/usr/bin/env node
/**
 * Answer "who would this device secret be on this contract, and does that
 * identity already have history?" without opening a browser.
 *
 *   npx tsx src/midnight/whoami.ts <contract-address> <device-secret-hex>
 *
 * Identity on Midnight is not an address you are given, it is
 * `dappKey(localSk(), deploymentId)` — a hash of a secret that never leaves
 * the device, salted by the deployment. So the only way to learn a key is to
 * hold the secret and compute it, which is exactly what this does.
 *
 * The second question matters as much as the first. `hire` asserts
 * `!agreedRate.member(worker)`, and a sealed rate is never removed — not even
 * by `endEmployment`. A key that has been hired once can never be hired
 * again, so "pick a fresh secret" is a real prerequisite for a demo, not a
 * preference. This prints that verdict rather than making you find it out
 * from a failed proof.
 *
 * Read-only: no wallet, no proof server, no transaction. The secret is used
 * for one local hash and is never persisted or sent anywhere.
 */
import { WebSocket } from 'ws';
// The indexer provider opens a GraphQL subscription even for a one-shot
// query, and Node has no global WebSocket (midnight-js skill §5).
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ledger, pureCircuits } from './contract.js';
import { bytesToHex, hexToBytes } from './encoding.js';
import type { NetworkId } from './network.js';
import { INDEXER_ENDPOINTS } from './network.js';

/** A Compact `Map` ledger field — `size()` is a method, not a property. */
type LedgerMap<V> = Iterable<[Uint8Array, V]> & { size(): bigint };

function lookup<V>(map: LedgerMap<V>, keyHex: string): { found: boolean; value?: V } {
  for (const [key, value] of map) if (bytesToHex(key) === keyHex) return { found: true, value };
  return { found: false };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a) => !a.startsWith('--'));
  const [address, secretHex] = positional;
  if (!address || !secretHex) {
    console.error('usage: whoami.ts <contract-address> <device-secret-hex> [--network undeployed|preprod|preview|mainnet]');
    process.exit(2);
  }
  const bare = secretHex.replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(bare)) {
    console.error('The device secret must be exactly 64 hex characters (32 bytes).');
    process.exit(2);
  }

  const networkIndex = argv.indexOf('--network');
  const networkId = (networkIndex >= 0 ? argv[networkIndex + 1] : 'undeployed') as NetworkId;
  setNetworkId(networkId);

  const endpoints = INDEXER_ENDPOINTS[networkId];
  const contractState = await indexerPublicDataProvider(
    endpoints.http,
    endpoints.ws,
  ).queryContractState(address);
  if (contractState === null) {
    console.error(`No contract at ${address} on ${networkId}.`);
    process.exit(1);
  }

  const state = ledger(contractState.data);
  const key = bytesToHex(pureCircuits.dappKey(hexToBytes(bare), state.deploymentId));

  console.log(`contract    ${address} (${networkId})`);
  console.log(`your key    ${key}`);
  console.log('');
  console.log(`is employer     ${key === bytesToHex(state.employerKey) ? 'YES' : 'no'}`);

  const hired = lookup(state.agreedRate as LedgerMap<unknown>, key).found;
  console.log(`has sealed rate ${hired ? 'YES — this key can never be hired again' : 'no  — hireable'}`);

  // `active` is Map<Bytes<32>, Boolean> and endEmployment does
  // `active.insert(w, false)` rather than removing the row, so membership
  // alone says "has accepted an offer at some point", not "is employed".
  // The value is the one that matters.
  const employment = lookup(state.active as LedgerMap<boolean>, key);
  console.log(
    `employment      ${!employment.found ? 'never accepted an offer' : employment.value ? 'ACTIVE' : 'ended (former employee)'}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // The indexer subscription keeps the event loop alive; inspect.ts and
    // deploy.ts document the same handle leak at their own exits.
    process.exit(process.exitCode ?? 0);
  });
