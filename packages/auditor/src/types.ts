/**
 * Types for the auditor view — public read-only payment verification.
 * Never contains private data like salaries or secrets.
 */

export type WorkerKey = string;  // '0x7f3a…' — a person's ID
export type Period = string;      // '2026-03' — one month
export type PeriodStatus = 'confirmed' | 'unconfirmed' | 'pending';

export interface PeriodRecord {
  period: Period;
  status: PeriodStatus;
  hoursApproved: boolean;
  contributionVerified?: boolean;
}

export interface WorkerRecord {
  workerKey: WorkerKey;
  employmentStart: string;  // ISO date or 'Present'
  employmentEnd: string | undefined;   // ISO date or undefined if still employed
  periods: PeriodRecord[];
  confirmedCount: number;
  unconfirmedCount: number;
}

export interface AuditorState {
  workers: WorkerRecord[];
  unconfirmedCount: number;
  isLoading: boolean;
  error?: string;
}

export interface WorkerDetail {
  workerKey: WorkerKey;
  employedSince: string;
  currentlyEmployed: boolean;
  confirmedMonths: number;
  unconfirmedMonths: number;
  periods: PeriodRecord[];
}
