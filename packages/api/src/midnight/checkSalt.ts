import { pureCircuits } from './contract.js';
import { bytesToHex, hexToBytes } from './encoding.js';

const [rate, salt, expected] = process.argv.slice(2);
if (!rate || !salt || !expected) {
  console.error('usage: checkSalt.ts <rate> <salt-hex> <expected-commitment-hex>');
  process.exit(1);
}
const commitment = bytesToHex(pureCircuits.sealRate(BigInt(rate), hexToBytes(salt)));
console.log('sealRate(rate, salt) =', commitment);
console.log('on-chain commitment  =', expected);
console.log(commitment.toLowerCase() === expected.toLowerCase() ? 'MATCH — acceptHire will pass' : 'MISMATCH — acceptHire would be rejected');
