// Does witnesses.ts fill the hole? Deploy locally, hire as the employer,
// then prove a stranger cannot.
import * as RT from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from './src/managed/contract/index.js';

const COIN = '0'.repeat(64);
const ADDR = RT.sampleContractAddress();
const secret = (n) => new Uint8Array(32).fill(n);

const witnesses = {
  localSk: ({ privateState }) => [privateState, privateState.secretKey],
};
const contract = new Contract(witnesses);

// 1. Deploy — constructor derives employerKey from the deployer's secret
const employerState = { secretKey: secret(7) };
const ctor = contract.initialState(RT.createConstructorContext(employerState, COIN));
console.log('1. deploy: employerKey =', ledger(ctor.currentContractState.data).employerKey.length, 'bytes ✅');

// 2. Employer hires — should pass the assert
const ctx = RT.createCircuitContext(ADDR, COIN, ctor.currentContractState, employerState);
const r = contract.impureCircuits.hire(ctx, secret(9), secret(1));
console.log('2. hire as employer: OK, agreedRate size =',
  ledger(r.context.currentQueryContext.state).agreedRate.size(), '✅');

// 3. Stranger with a different secret — the assert must reject
try {
  const strangerCtx = RT.createCircuitContext(ADDR, COIN, ctor.currentContractState, { secretKey: secret(42) });
  contract.impureCircuits.hire(strangerCtx, secret(10), secret(1));
  console.log('3. STRANGER HIRE SUCCEEDED — BUG');
} catch (e) {
  console.log('3. stranger rejected ✅ —', String(e.message).split('\n')[0].slice(0, 70));
}
