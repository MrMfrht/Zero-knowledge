/**
 * `0x`-prefixed hex helpers, for the boundary between the domain types in
 * `@nightshift/shared` (`WorkerKey`, `Commitment`, `Salt` — all `0x`-prefixed
 * hex strings) and the raw `Uint8Array`/`bigint` arguments the compiled
 * contract's circuits actually take (see `managed/contract/index.d.ts`).
 *
 * Written without `Buffer` on purpose. This package runs in the browser —
 * that is the whole trust boundary the product rests on — and `Buffer` is a
 * Node global that is simply not there. It happened to typecheck because
 * `@types/node` is installed, and the first time an app loaded this module it
 * died with "Buffer is not defined" before rendering anything. Polyfilling
 * would work too, but a hex encoder does not need 40kB of shim.
 *
 * `unhex` and `hexOctets` below are the plain equivalents.
 */

const HEX_OCTETS = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, '0'));

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  let hex = '';
  for (const byte of bytes) hex += HEX_OCTETS[byte];
  return `0x${hex}`;
}

export function hexToBytes(hex: string): Uint8Array {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (stripped.length % 2 !== 0) {
    throw new Error(`Hex string must have an even number of digits, got ${stripped.length}`);
  }
  const bytes = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const octet = Number.parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
    // `Buffer.from(hex, 'hex')` silently truncated at the first bad character,
    // so a typo'd worker key became a short, valid-looking Uint8Array. Saying
    // so is better than hashing the wrong thing and reporting "not found".
    if (Number.isNaN(octet)) throw new Error(`"${hex}" is not valid hex`);
    bytes[i] = octet;
  }
  return bytes;
}
