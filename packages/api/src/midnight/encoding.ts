/**
 * `0x`-prefixed hex helpers, for the boundary between the domain types in
 * `@nightshift/shared` (`WorkerKey`, `Commitment`, `Salt` — all `0x`-prefixed
 * hex strings) and the raw `Uint8Array`/`bigint` arguments the compiled
 * contract's circuits actually take (see `managed/contract/index.d.ts`).
 */

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(bytes).toString('hex')}`;
}

export function hexToBytes(hex: string): Uint8Array {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(stripped, 'hex'));
}
