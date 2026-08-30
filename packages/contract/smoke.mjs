// The whole lifecycle, run locally against the compiled contract. No network,
// no Docker, no proof server — just the circuits and the runtime.
//
// This is THE-FLOW.md executed for real, including the failure cases the demo
// is built around. Every ❌ line below is a rejection we WANT.
//
//   npm run smoke -w @nightshift/contract

import * as RT from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, pureCircuits } from './src/managed/contract/index.js';

const COIN = '0'.repeat(64);
const ADDR = RT.sampleContractAddress();
const secret = (n) => new Uint8Array(32).fill(n);

const witnesses = {
  localSk: ({ privateState }) => [privateState, privateState.secretKey],
};
const contract = new Contract(witnesses);

const employer = { secretKey: secret(7) };
const karim = { secretKey: secret(9) };
const stranger = { secretKey: secret(42) };

// Karim's app would show him this; here we compute it the same way the api will.
const karimKey = pureCircuits.dappKey(karim.secretKey);

const RATE = 5000n;
const SALT = crypto.getRandomValues(new Uint8Array(32));
const PCT = 25n; // contribution percentage, fixed at deployment

let state; // the evolving chain state (a StateValue/ChargedState throughout)
const asUser = (user) => RT.createCircuitContext(ADDR, COIN, state, user);
const run = (user, circuit, ...args) => {
  const r = contract.impureCircuits[circuit](asUser(user), ...args);
  state = r.context.currentQueryContext.state;
  return r;
};
const mustFail = (label, fn) => {
  try { fn(); console.log(`   BUG — ${label} SUCCEEDED`); process.exitCode = 1; }
  catch (e) { console.log(`   ❌ ${label} → rejected: "${String(e.message).split(':').pop().trim().slice(0, 55)}"`); }
};

// ─── Step 3: deploy + hire (employer) ───────────────────────────────────────
const ctor = contract.initialState(RT.createConstructorContext(employer, COIN), PCT);
state = ctor.currentContractState.data;
console.log('deploy(pct=25): employerKey on chain ✅');

const commitment = pureCircuits.sealRate(RATE, SALT); // the api's job, done identically
run(employer, 'hire', karimKey, commitment);
console.log('hire: sealed envelope on chain, agreedRate size =', ledger(state).agreedRate.size(), '✅');
mustFail('stranger hiring', () => run(stranger, 'hire', secret(1), commitment));

// ─── Step 5: acceptHire (Karim) ─────────────────────────────────────────────
mustFail('accepting with the WRONG rate (employer lied?)',
  () => run(karim, 'acceptHire', 4000n, SALT));
run(karim, 'acceptHire', RATE, SALT);
console.log('acceptHire(5000, salt): seal opens, Karim active ✅');

// ─── Step 6: approveHours (employer) ────────────────────────────────────────
mustFail('Karim approving his own hours', () => run(karim, 'approveHours', karimKey, 1n, 1n));
run(employer, 'approveHours', karimKey, 1n, 1n); // period 1, hours 1 (salaried)
console.log('approveHours(period 1, hours 1) ✅');

// ─── Step 8: confirmPayment (Karim) — THE PRODUCT ───────────────────────────
mustFail('confirming an UNDERPAYMENT of 4000  ← THE DEMO',
  () => run(karim, 'confirmPayment', 1n, RATE, SALT, 4000n));
run(karim, 'confirmPayment', 1n, RATE, SALT, 5000n);
console.log('confirmPayment(5000): paidFor ✓, amount on chain: NOWHERE ✅');
mustFail('confirming the same period twice',
  () => run(karim, 'confirmPayment', 1n, RATE, SALT, 5000n));

// ─── Circuit 5: proveContribution (Karim) ───────────────────────────────────
// earnings = 1 × 5000; correct declaration = 5000 × 25% = 1250
mustFail('an UNDER-DECLARED contribution of 1000',
  () => run(karim, 'proveContribution', 1n, RATE, SALT, 1000n));
run(karim, 'proveContribution', 1n, RATE, SALT, 1250n);
console.log('proveContribution(1250 = 25% of real earnings): contributionOk ✓ ✅');

// ─── Circuit 6: endEmployment (employer) ────────────────────────────────────
mustFail('Karim ending his own employment', () => run(karim, 'endEmployment', karimKey));
run(employer, 'endEmployment', karimKey);
console.log('endEmployment: active=false, history intact ✅');
mustFail('approving hours AFTER employment ended',
  () => run(employer, 'approveHours', karimKey, 2n, 1n));
mustFail('ending employment twice', () => run(employer, 'endEmployment', karimKey));

// ─── The final ledger, as any auditor (E) would read it ─────────────────────
const L = ledger(state);
console.log('\nfinal public ledger:');
console.log('  paidFor:', L.paidFor.size().toString(), '✓  contributionOk:', L.contributionOk.size().toString(), '✓  active(karim):', L.active.lookup(karimKey));
console.log('  contributionRate:', L.contributionRate.toString(), "(public — the law's number, not a secret)");
console.log('  anywhere to read a salary or amount: NO — the ledger type has no such field');
