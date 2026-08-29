/**
 * Types shared with frontends. TYPES ONLY — never a class, never a service,
 * never anything with a decorator on it. Always import with `import type`.
 */
export interface DirectoryEntry {
  workerKey: string;
  fullName: string;
  email: string;
  department: string;
  jobTitle: string;
}

export type TimesheetStatus =
  | 'draft'
  | 'submitted'
  | 'pending-onchain'
  | 'approved-onchain'
  | 'rejected';

export interface Timesheet {
  id: string;
  workerKey: string;
  period: string;
  hours: number;
  note?: string;
  status: TimesheetStatus;
  onchainTxHash?: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  workerKey: string;
  type: 'payment-due' | 'unconfirmed-period' | 'timesheet-submitted' | 'offer-pending';
  message: string;
  createdAt: string;
  readAt?: string;
}

export interface ReportSummary {
  activeHeadcount: number;
  totalConfirmedPeriods: number;
  totalUnconfirmedPeriods: number;
  contributionVerifiedCount: number;
  generatedAt: string;
}
