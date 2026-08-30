import React from 'react';
import { usePayroll, PERSONAS } from '../context/PayrollContext.tsx';
import { ShieldCheck, RotateCcw, User, Sparkles } from 'lucide-react';

export const Header: React.FC = () => {
  const { activeWorkerKey, setPersona, resetStore, loading } = usePayroll();

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

      <div className="controls-section">
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

        <div className="badge badge-confirmed" style={{ fontSize: '0.75rem' }}>
          <Sparkles size={12} /> Mock API (In-Memory)
        </div>
      </div>
    </header>
  );
};
