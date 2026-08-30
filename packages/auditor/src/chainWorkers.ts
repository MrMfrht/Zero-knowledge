/**
 * The audit board, read from the chain.
 *
 * This is the one screen in NightShift that needs no wallet, no login and no
 * permission of any kind — everything it shows is already public to anyone
 * with the contract address. So it talks to the indexer directly through
 * `@nightshift/api` and never asks for a key.
 *
 * The board has always had its own `WorkerRecord` shape, deliberately: it is
 * a view model with a "pending" state and pre-computed counts, not the domain
 * record. This is the seam between the two, and keeping it in one file is
 * what lets the board keep rendering demo fixtures when no contract is
 * configured.
 */
import { createPayrollApi, payrollApiConfigFromEnv, formatPeriod } from '@nightshift/api';
import type { EmploymentRecord } from '@nightshift/api';
import type { PeriodRecord, WorkerRecord } from './types';

export interface BoardData {
  readonly workers: WorkerRecord[];
  /** Every period any worker has, sorted — the board's columns. */
  readonly periods: string[];
}

/**
 * Is a contract configured? If not the board shows fixtures, and says so.
 *
 * Exported so the header can state which one the viewer is looking at. A
 * public audit board that is quietly displaying made-up rows is the single
 * most damaging failure this app has available to it.
 */
export function boardIsLive(): boolean {
  return Boolean(payrollApiConfigFromEnv(import.meta.env).contractAddress);
}

export function boardBackendLabel(): string {
  return createPayrollApi({ ...payrollApiConfigFromEnv(import.meta.env), actingAs: '0x0' }).label;
}

export async function loadBoardFromChain(): Promise<BoardData> {
  // `actingAs` is required by the mock and ignored on chain; this path only
  // runs when a contract address is set, so it is never used.
  const { api } = createPayrollApi({ ...payrollApiConfigFromEnv(import.meta.env), actingAs: '0x0' });
  return toBoardData(await api.listEmploymentRecords());
}

export function toBoardData(records: readonly EmploymentRecord[]): BoardData {
  const workers = records.map(toWorkerRecord);
  const periods = [...new Set(workers.flatMap((w) => w.periods.map((p) => p.period)))].sort();
  return { workers, periods };
}

function toWorkerRecord(record: EmploymentRecord): WorkerRecord {
  const periods: PeriodRecord[] = record.periods.map((p) => ({
    period: p.period,
    // The board has three states, the domain has four. `awaiting-hours` and
    // `awaiting-confirmation` both mean "nothing has gone wrong yet", and the
    // board draws them the same way — so they collapse to `pending`. What must
    // NOT collapse is `unconfirmed`: that is the whole point of the board.
    status: p.status === 'confirmed' ? 'confirmed' : p.status === 'unconfirmed' ? 'unconfirmed' : 'pending',
    hoursApproved: p.hours !== null,
    contributionVerified: p.contributionVerified,
  }));

  const first = record.periods.at(0)?.period;
  const last = record.periods.at(-1)?.period;

  return {
    workerKey: record.workerKey,
    employmentStart: first ? formatPeriod(first) : 'Unknown',
    // A worker whose employment ended has no "end period" on chain — only the
    // `active` flag flipping. The last period they have a record for is the
    // closest honest answer, and it is left undefined while they are active.
    employmentEnd: record.active ? undefined : last ? formatPeriod(last) : undefined,
    periods,
    confirmedCount: periods.filter((p) => p.status === 'confirmed').length,
    unconfirmedCount: periods.filter((p) => p.status === 'unconfirmed').length,
  };
}
