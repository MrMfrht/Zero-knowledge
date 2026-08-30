import { useState, useMemo, useEffect } from 'react';
import { Shield, Lock, Eye } from 'lucide-react';
import { boardIsLive, boardBackendLabel, loadBoardFromChain } from './chainWorkers';
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

  /**
   * Real contract if VITE_CONTRACT_ADDRESS is set, fixtures otherwise.
   *
   * The board needs no wallet either way — everything on it is public to
   * anyone holding the contract address, which is the claim the whole project
   * rests on. What it does need is to say which of the two you are looking
   * at: a public audit board silently rendering invented rows would discredit
   * every other guarantee here.
   */
  const live = useMemo(() => boardIsLive(), []);
  const [workers, setWorkers] = useState<WorkerRecord[]>(live ? [] : DEMO_WORKERS);
  const [periods, setPeriods] = useState<string[]>(live ? [] : DEMO_PERIODS);
  const [loading, setLoading] = useState(live);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    loadBoardFromChain()
      .then((board) => {
        if (cancelled) return;
        setWorkers(board.workers);
        // An empty chain has no periods to show columns for, so fall back to
        // the demo months rather than rendering a board with no grid at all.
        setPeriods(board.periods.length > 0 ? board.periods : DEMO_PERIODS);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Shown, not swallowed. "The board is empty" and "the indexer is
        // down" look identical otherwise, and they mean opposite things.
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [live]);

  const stats = useMemo(
    () => ({
      totalWorkers: workers.length,
      unconfirmedCount: workers.reduce((sum, w) => sum + w.unconfirmedCount, 0),
    }),
    [workers],
  );

  const selectedWorker = workers.find((w) => w.workerKey === selectedWorkerKey) || null;

  return (
    <div className="auditor-container">
      {/* Header */}
      <header className="auditor-header">
        <h1>NightShift Payment Audit Board</h1>
        <p className="auditor-header-subtitle">
          Public verification of employee payment confirmations — no wallet, no login, no permissions required
        </p>

        {/* Which data is on screen. See the comment on `live` above. */}
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
            backgroundColor: live ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
            borderLeft: `3px solid ${live ? 'var(--color-confirmed)' : 'var(--color-unconfirmed)'}`,
          }}
        >
          {live
            ? `Reading the Midnight ledger — ${boardBackendLabel()}${loading ? ' (loading…)' : ''}`
            : 'Demo data — no contract configured. Set VITE_CONTRACT_ADDRESS to audit a real deployment.'}
        </div>

        {loadError && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderLeft: '3px solid var(--color-unconfirmed)',
            }}
          >
            Could not read the chain: {loadError}
          </div>
        )}

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
          <Board workers={workers} onWorkerClick={setSelectedWorkerKey} periods={periods} />

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
