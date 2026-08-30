/**
 * Send NIGHT from the local devnet's genesis wallet to any Bech32m address.
 *
 * WHY THIS EXISTS
 *
 * A browser wallet on the local devnet starts with nothing: 0 NIGHT, 0 DUST,
 * and DUST is what pays for every transaction. Without it, "Connect Wallet"
 * succeeds and then every single write fails to balance. The official
 * `midnight-local-dev` tool solves this with a funding menu ("[2] Fund
 * accounts by public key"), but this repo runs its own `docker/compose.yml`
 * rather than that tool, so the same job is done here.
 *
 * This is the devnet-only twin of the funding step, and nothing else. It
 * moves NIGHT; it never touches a witness secret, a salt, or a rate. The
 * genesis seed below is the well-known dev-preset value baked into
 * `CFG_PRESET: 'dev'` -- it is public, it funds nothing real, and it must
 * never be used against preview, preprod, or mainnet.
 *
 * Usage, once the wallet has shown you its receive address:
 *
 *     npm run fund -w @nightshift/api -- --to mn_addr_undeployed1...
 *
 * Then, IN THE WALLET, designate the received NIGHT for DUST generation
 * ("Generate tDUST"). That second step cannot be done from here: registering
 * a UTXO for DUST generation must be signed by the key that owns it.
 */
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { createHeadlessWallet, signTransactionIntents } from './headlessWallet.js';
import { INDEXER_ENDPOINTS, type NetworkId } from './network.js';

/** The dev preset's pre-mined genesis master wallet. Public by design. */
const GENESIS_SEED_HEX = '0000000000000000000000000000000000000000000000000000000000000001';

/**
 * NIGHT is quoted to six decimal places on the wire, so one NIGHT is
 * 1_000_000 base units. Passing 50_000 raw buys 0.05 NIGHT, which looks like
 * a successful transfer and then generates DUST too slowly to ever pay for a
 * transaction -- a failure that shows up ten minutes later as an empty tank.
 * `--amount` is therefore in whole NIGHT and multiplied here.
 */
const BASE_UNITS_PER_NIGHT = 1_000_000n;

/** Matches what `midnight-local-dev` hands each account. */
const DEFAULT_AMOUNT_NIGHT = 50_000n;

function parseArgs(argv: string[]) {
  const get = (flag: string, fallback?: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : fallback;
  };
  const networkId = (get('--network', 'undeployed') as NetworkId) ?? 'undeployed';
  const endpoints = INDEXER_ENDPOINTS[networkId];
  return {
    to: get('--to'),
    amountNight: BigInt(get('--amount', String(DEFAULT_AMOUNT_NIGHT))!),
    networkId,
    seedHex: get('--seed', GENESIS_SEED_HEX)!,
    indexerUri: get('--indexer', endpoints.http)!,
    indexerWsUri: get('--indexer-ws', endpoints.ws)!,
    nodeUri: get('--node', 'http://127.0.0.1:9944')!,
    nodeWsUri: get('--node-ws', 'ws://127.0.0.1:9944')!,
    proofServerUri: get('--proof-server', 'http://127.0.0.1:6300')!,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.to) {
    throw new Error(
      'Missing --to. Open the wallet, press Receive, copy the address, then:\n' +
        '  npm run fund -w @nightshift/api -- --to <bech32m address>',
    );
  }
  if (args.networkId !== 'undeployed') {
    throw new Error(
      `Refusing to run against "${args.networkId}". This script spends a publicly known ` +
        'genesis seed and only makes sense against a throwaway local devnet.',
    );
  }

  // Parsing before the wallet starts turns a typo'd address into an instant
  // error instead of one that surfaces 60 seconds later, after a full sync.
  const receiverAddress = MidnightBech32m.parse(args.to).decode(UnshieldedAddress, args.networkId);

  console.log(`Funding ${args.to}`);
  console.log(`  amount:  ${args.amountNight} NIGHT (${args.amountNight * BASE_UNITS_PER_NIGHT} base units)`);
  console.log(`  network: ${args.networkId}`);

  const genesis = await createHeadlessWallet({
    networkId: args.networkId,
    seedHex: args.seedHex,
    indexerUri: args.indexerUri,
    indexerWsUri: args.indexerWsUri,
    nodeUri: args.nodeUri,
    nodeWsUri: args.nodeWsUri,
    proofServerUri: args.proofServerUri,
  });

  try {
    const recipe = await genesis.wallet.transferTransaction(
      [
        {
          type: 'unshielded',
          outputs: [
            {
              type: unshieldedToken().raw,
              receiverAddress,
              amount: args.amountNight * BASE_UNITS_PER_NIGHT,
            },
          ],
        },
      ],
      genesis.secretKeys,
      { ttl: new Date(Date.now() + 30 * 60 * 1000), payFees: true },
    );

    // Spending unshielded NIGHT needs a signature over each intent, and the
    // SDK's own signRecipe cannot supply it (see signTransactionIntents).
    // Without this the node accepts nothing and answers only
    // "1010: Invalid Transaction: Custom error: 192" -- no mention of a
    // missing signature anywhere.
    // transferTransaction returns { type: 'UNPROVEN_TRANSACTION', transaction }
    // -- one transaction, not the baseTransaction/balancingTransaction pair
    // that balanceUnboundTransaction hands back. Pre-proof for the same
    // reason: nothing here has been proven yet.
    const unproven = recipe as unknown as { transaction: { intents?: Map<number, unknown> } };
    signTransactionIntents(unproven.transaction, genesis.signData, 'pre-proof');

    const finalized = await genesis.wallet.finalizeRecipe(recipe);
    const txId = await genesis.wallet.submitTransaction(finalized);

    console.log(`\nSubmitted: ${txId}`);
    console.log(
      '\nNow finish in the wallet: it holds NIGHT but still has no DUST, and DUST is what\n' +
        'pays for transactions. Press "Generate tDUST" (designate the NIGHT) and wait for the\n' +
        'tank to fill. Registering a UTXO for DUST generation has to be signed by the key that\n' +
        'owns it, so it cannot be done from this script.',
    );
  } finally {
    await genesis.stop();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
