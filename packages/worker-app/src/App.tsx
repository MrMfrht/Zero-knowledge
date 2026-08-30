import React from 'react';
import { PayrollProvider, usePayroll } from './context/PayrollContext.tsx';
import { Header } from './components/Header.tsx';
import { PrivacyPanel } from './components/PrivacyPanel.tsx';
import { AcceptOfferCard } from './components/AcceptOfferCard.tsx';
import { PaymentList } from './components/PaymentList.tsx';
import { CheckCircle2, AlertOctagon, AlertTriangle } from 'lucide-react';

const WorkerAppContent: React.FC = () => {
  const { record, activePersona, error } = usePayroll();

  const confirmedPeriods = record?.periods.filter((p) => p.status === 'confirmed').length ?? 0;
  const unconfirmedPeriods = record?.periods.filter((p) => p.status === 'unconfirmed').length ?? 0;
  const awaitingConfirmation = record?.periods.filter((p) => p.status === 'awaiting-confirmation').length ?? 0;

  return (
    <div className="app-container">
      <Header />

      {error && (
        <div className="alert-box alert-error">
          <AlertOctagon size={20} />
          <div>{error}</div>
        </div>
      )}

      {/* Hero Banner */}
      <div className="glass-card hero-banner">
        <div className="worker-profile">
          <div className="avatar">
            {activePersona.name.charAt(0)}
          </div>
          <div className="profile-info">
            <h2>{activePersona.name}</h2>
            <div className="profile-meta">
              <span>{activePersona.role}</span>
              <span>•</span>
              <span>Worker ID: <code className="mono-key">{activePersona.key.slice(0, 10)}...</code></span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {activePersona.description}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="stat-card glass-card">
            <span className="stat-title">Confirmed</span>
            <span className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
              <CheckCircle2 size={18} style={{ display: 'inline', marginRight: 6 }} />
              {confirmedPeriods}
            </span>
          </div>

          <div className="stat-card glass-card">
            <span className="stat-title">Awaiting</span>
            <span className="stat-value" style={{ color: 'var(--accent-amber)' }}>
              <AlertTriangle size={18} style={{ display: 'inline', marginRight: 6 }} />
              {awaitingConfirmation}
            </span>
          </div>

          {unconfirmedPeriods > 0 && (
            <div className="stat-card glass-card">
              <span className="stat-title">Unconfirmed</span>
              <span className="stat-value" style={{ color: 'var(--accent-rose)' }}>
                <AlertOctagon size={18} style={{ display: 'inline', marginRight: 6 }} />
                {unconfirmedPeriods}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Accept Offer Card (if applicable) */}
      <AcceptOfferCard />

      {/* Active Persona Banner for Sam (Demo Moment Warning) */}
      {activePersona.name === 'Sam' && (
        <div className="alert-box alert-error">
          <AlertOctagon size={24} style={{ flexShrink: 0, color: 'var(--accent-rose)' }} />
          <div>
            <div className="alert-error-title">March 2026: Unconfirmed Payment Demo Moment</div>
            <div>
              Employer paid $4,000 on a $4,200 salary agreement. The Midnight Compact circuit refused to confirm the payment, leaving <strong>March 2026</strong> permanently unconfirmed on the public record while keeping the exact $4,200 rate private.
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="main-grid">
        <PaymentList />
        <PrivacyPanel />
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <PayrollProvider>
      <WorkerAppContent />
    </PayrollProvider>
  );
};

export default App;
