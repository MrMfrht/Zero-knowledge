import { useState, useMemo } from 'react';
import { Shield, Lock, Eye } from 'lucide-react';
import { Board } from './components/Board';
import { WorkerDetail } from './components/WorkerDetail';
import { UnconfirmedIndicator } from './components/UnconfirmedIndicator';
import type { WorkerRecord } from './types';

/**
 * Auditor view: the public board that proves the project works.
 *
 * No wallet needed. No login. No permissions. Anyone can verify that every
 * employee was paid correctly, without being given access to anything and
 * without ever learning what anyone earns.
 *
 * This is the demo screen. Everything else in the project is scaffolding for this.
 */

// Demo data: seeded state for development
const DEMO_WORKERS: WorkerRecord[] = [
  {
    workerKey: '0x7f3a4c8d2b9e1f5a',
    employmentStart: 'January 2026',
    employmentEnd: undefined as string | undefined,
    periods: [
      { period: '2026-01', status: 'confirmed', hoursApproved: true, contributionVerified: true },
      { period: '2026-02', status: 'confirmed', hoursApproved: true, contributionVerified: true },
      { period: '2026-03', status: 'confirmed', hoursApproved: true, contributionVerified: true },
      { period: '2026-04', status: 'confirmed', hoursApproved: true, contributionVerified: true },
      { period: '2026-05', status: 'pending', hoursApproved: false },
    ],
    confirmedCount: 4,
    unconfirmedCount: 0,
  },
  {
    workerKey: '0x91b2e7f4c3a9d1f6',
    employmentStart: 'January 2026',
    employmentEnd: undefined as string | undefined,
    periods: [
      { period: '2026-01', status: 'confirmed', hoursApproved: true, contributionVerified: true },
      { period: '2026-02', status: 'confirmed', hoursApproved: true, contributionVerified: true },
      { period: '2026-03', status: 'unconfirmed', hoursApproved: true, contributionVerified: false },
      { period: '2026-04', status: 'confirmed', hoursApproved: true, contributionVerified: true },
      { period: '2026-05', status: 'pending', hoursApproved: false },
    ],
    confirmedCount: 3,
    unconfirmedCount: 1,
  },
  {
    workerKey: '0xc4e8b1d7a2f9c5e3',
    employmentStart: 'February 2026',
    employmentEnd: undefined as string | undefined,
    periods: [
      { period: '2026-02', status: 'confirmed', hoursApproved: true, contributionVerified: true },
      { period: '2026-03', status: 'confirmed', hoursApproved: true, contributionVerified: true },
      { period: '2026-04', status: 'confirmed', hoursApproved: true, contributionVerified: true },
      { period: '2026-05', status: 'pending', hoursApproved: false },
    ],
    confirmedCount: 3,
    unconfirmedCount: 0,
  },
];

const DEMO_PERIODS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];

export default function App() {
  const [selectedWorkerKey, setSelectedWorkerKey] = useState<string | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    const unconfirmed = DEMO_WORKERS.reduce((sum, w) => sum + w.unconfirmedCount, 0);
    return {
      totalWorkers: DEMO_WORKERS.length,
      unconfirmedCount: unconfirmed,
    };
  }, []);

  const selectedWorker = DEMO_WORKERS.find((w) => w.workerKey === selectedWorkerKey) || null;

  return (
    <div className="auditor-container">
      {/* Header */}
      <header className="auditor-header">
        <h1>NightShift Payment Audit Board</h1>
        <p className="auditor-header-subtitle">
          Public verification of employee payment confirmations — no wallet, no login, no permissions required
        </p>

        {/* Key Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '0.375rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Total Workers</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text)' }}>
              {stats.totalWorkers}
            </div>
          </div>
          {stats.unconfirmedCount > 0 && (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '0.375rem',
                borderLeft: '3px solid var(--color-unconfirmed)',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Unconfirmed Periods</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-unconfirmed)' }}>
                {stats.unconfirmedCount}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="auditor-main">
        <div className="board-wrapper">
          {/* Unconfirmed Alert (if any) */}
          <UnconfirmedIndicator unconfirmedCount={stats.unconfirmedCount} />

          {/* The Board: click a worker to see details */}
          <Board workers={DEMO_WORKERS} onWorkerClick={setSelectedWorkerKey} periods={DEMO_PERIODS} />

          {/* Worker Detail Modal */}
          <WorkerDetail
            worker={selectedWorker}
            isOpen={selectedWorkerKey !== null}
            onClose={() => setSelectedWorkerKey(null)}
          />

          {/* Privacy & Access Model */}
          <div className="privacy-panel">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Shield size={20} style={{ color: 'var(--color-sealed)' }} />
              Why You Can Trust This Board
            </h3>
            <ul className="privacy-list">
              <li className="privacy-item">
                <Eye size={18} />
                <span>
                  <strong>No login required:</strong> Anyone can view this page. A regulator, a journalist, a
                  worker's lawyer, or a stranger — all have the same access.
                </span>
              </li>
              <li className="privacy-item">
                <Lock size={18} />
                <span>
                  <strong>Salary is sealed:</strong> The agreed salary is locked in a cryptographic commitment on
                  the blockchain. It is not readable by anyone — not by your employer, not by this page, not by any
                  auditor.
                </span>
              </li>
              <li className="privacy-item">
                <Shield size={18} />
                <span>
                  <strong>Confirmation proves payment:</strong> A ✅ means the worker confirmed they received the
                  amount they agreed to. A ✗ means they could not confirm — either the amount was wrong or it did
                  not arrive.
                </span>
              </li>
              <li className="privacy-item">
                <Lock size={18} />
                <span>
                  <strong>Hours are public, rate is not:</strong> Hours worked are visible — the public already
                  knows them. The hourly rate stays hidden. That is selective disclosure in practice.
                </span>
              </li>
            </ul>

            {/* Emphasize Privacy Model */}
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderRadius: '0.375rem',
                borderLeft: '3px solid var(--color-sealed)',
              }}
            >
              <p style={{ marginBottom: '0.5rem', fontWeight: '600', color: 'var(--color-text)' }}>
                The Core Claim:
              </p>
              <p>
                Anyone can verify that every employee was paid correctly, <strong>without being given access</strong>
                {' '}
                to anything, and <strong>without ever learning what anyone earns.</strong>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="auditor-footer">
        <p>
          NightShift — Private Payroll with Public Proof, powered by Midnight Zero-Knowledge Contracts
        </p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
          This view queries immutable public blockchain data. No login, no wallet, no permissions.
        </p>
      </footer>
    </div>
  );
}
