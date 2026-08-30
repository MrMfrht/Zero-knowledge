import React from 'react';
import { usePayroll, PERSONAS } from '../context/PayrollContext.tsx';
import { ShieldCheck, RotateCcw, User, Sparkles } from 'lucide-react';

export const Header: React.FC = () => {
  const { activeWorkerKey, activePersona, live, backendLabel, setPersona, resetStore, loading } =
    usePayroll();

  return (
    <header className="glass-card app-header">
      <div className="brand-section">
        <div className="brand-logo">
          <ShieldCheck size={26} />
        </div>
        <div className="brand-title">
          <h1>NightShift</h1>
          <div className="brand-subtitle">Employee Portal • Sealed Salary & Public Verification</div>
        </div>
      </div>

      {/*
        The persona selector and the reset button are mock-only, and hiding
        them live is not cosmetic. On a real contract identity comes from this
        browser's own secret via `dappKey(localSk(), deploymentId)` — nothing
        can act as someone else, and there is no state to reset. Leaving
        controls on screen that quietly do nothing is the fastest way to
        mislead someone about what the product actually guarantees.
      */}
      <div className="controls-section">
        {live ? (
          <div className="persona-select-container" title={activePersona.description}>
            <User size={16} className="persona-icon" style={{ color: 'var(--accent-indigo)' }} />
            <span className="persona-label">You:</span>
            <span className="persona-select" style={{ border: 'none', background: 'transparent' }}>
              {activeWorkerKey.slice(0, 10)}…
            </span>
          </div>
        ) : (
          <>
            <div className="persona-select-container">
              <User size={16} className="persona-icon" style={{ color: 'var(--accent-indigo)' }} />
              <span className="persona-label">Persona:</span>
              <select
                className="persona-select"
                value={activeWorkerKey}
                onChange={(e) => setPersona(e.target.value)}
                disabled={loading}
              >
                {PERSONAS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} ({p.role.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => resetStore()}
              title="Reset seeded mock data"
            >
              <RotateCcw size={14} />
              Reset Demo State
            </button>
          </>
        )}

        <div
          className={live ? 'badge badge-confirmed' : 'badge badge-awaiting-confirmation'}
          style={{ fontSize: '0.75rem' }}
          title={live ? backendLabel : 'No VITE_CONTRACT_ADDRESS set — running on in-memory fixtures'}
        >
          <Sparkles size={12} /> {live ? `Live — ${backendLabel}` : 'Mock API (In-Memory)'}
        </div>
      </div>
    </header>
  );
};
