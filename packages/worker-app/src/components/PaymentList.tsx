import React, { useState } from 'react';
import { usePayroll } from '../context/PayrollContext.tsx';
import type { Period, PeriodRecord } from '@nightshift/shared';
import { formatPeriod } from '@nightshift/shared';
import { ConfirmPaymentModal } from './ConfirmPaymentModal.tsx';
import { ContributionProofModal } from './ContributionProofModal.tsx';
import { CheckCircle2, AlertTriangle, Clock, XCircle, ShieldCheck, ArrowRight } from 'lucide-react';

export const PaymentList: React.FC = () => {
  const { record, loading } = usePayroll();
  const [confirmPeriod, setConfirmPeriod] = useState<Period | null>(null);
  const [contribPeriod, setContribPeriod] = useState<Period | null>(null);

  if (loading) {
    return (
      <div className="glass-card payments-section" style={{ textAlign: 'center', padding: '48px' }}>
        <Clock size={32} style={{ margin: '0 auto 12px', color: 'var(--accent-indigo)', animation: 'spin 1.5s linear infinite' }} />
        <div style={{ color: 'var(--text-secondary)' }}>Loading employment ledger...</div>
      </div>
    );
  }

  if (!record || record.periods.length === 0) {
    return (
      <div className="glass-card payments-section" style={{ textAlign: 'center', padding: '48px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No active payment history recorded on-chain yet.</p>
      </div>
    );
  }

  const getStatusBadge = (p: PeriodRecord) => {
    switch (p.status) {
      case 'confirmed':
        return (
          <span className="badge badge-confirmed">
            <CheckCircle2 size={13} /> Confirmed Paid
          </span>
        );
      case 'awaiting-confirmation':
        return (
          <span className="badge badge-awaiting-confirmation">
            <AlertTriangle size={13} /> Payment Due — Action Needed
          </span>
        );
      case 'awaiting-hours':
        return (
          <span className="badge badge-awaiting-hours">
            <Clock size={13} /> Waiting for Employer Hours
          </span>
        );
      case 'unconfirmed':
        return (
          <span className="badge badge-unconfirmed">
            <XCircle size={13} /> ✗ Not Confirmed (Closed)
          </span>
        );
    }
  };

  return (
    <div className="glass-card payments-section">
      <div className="section-header">
        <h2 className="section-title">My Payment Periods</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {record.periods.length} Periods Recorded
        </span>
      </div>

      <table className="payments-table">
        <thead>
          <tr>
            <th>Pay Period</th>
            <th>Approved Hours</th>
            <th>Ledger Verification Status</th>
            <th>Pension / NSSF Proof</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {record.periods.map((p) => (
            <tr key={p.period}>
              <td style={{ fontWeight: 600 }}>{formatPeriod(p.period)}</td>
              <td>
                {p.hours === null ? (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>Pending</span>
                ) : p.hours === 1 ? (
                  <span style={{ color: 'var(--text-secondary)' }}>Salaried (Full-time)</span>
                ) : (
                  <span>{p.hours} hrs</span>
                )}
              </td>
              <td>{getStatusBadge(p)}</td>
              <td>
                {p.status === 'confirmed' ? (
                  p.contributionVerified ? (
                    <span style={{ color: 'var(--accent-emerald)', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={14} /> 25% Verified
                    </span>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={() => setContribPeriod(p.period)}
                    >
                      Verify NSSF
                    </button>
                  )
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                )}
              </td>
              <td style={{ textAlign: 'right' }}>
                {p.status === 'awaiting-confirmation' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setConfirmPeriod(p.period)}
                  >
                    Confirm Payment <ArrowRight size={14} />
                  </button>
                )}
                {p.status === 'confirmed' && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 500 }}>
                    Verified on-chain
                  </span>
                )}
                {p.status === 'unconfirmed' && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', fontWeight: 500 }}>
                    Unconfirmed Record
                  </span>
                )}
                {p.status === 'awaiting-hours' && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Awaiting Employer
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmPeriod && (
        <ConfirmPaymentModal period={confirmPeriod} onClose={() => setConfirmPeriod(null)} />
      )}

      {contribPeriod && (
        <ContributionProofModal period={contribPeriod} onClose={() => setContribPeriod(null)} />
      )}
    </div>
  );
};
