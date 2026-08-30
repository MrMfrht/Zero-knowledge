import React, { useState } from 'react';
import { usePayroll } from '../context/PayrollContext.tsx';
import { Briefcase, CheckCircle, AlertOctagon, HelpCircle } from 'lucide-react';

export const AcceptOfferCard: React.FC = () => {
  const { offer, acceptOffer, loading } = usePayroll();
  const [enteredRate, setEnteredRate] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  if (!offer) {
    return null;
  }

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredRate.trim()) return;

    setSubmitting(true);
    setMismatchError(null);

    try {
      const rateBigInt = BigInt(enteredRate);
      const res = await acceptOffer(rateBigInt, offer.salt);
      if (!res.success && res.error) {
        setMismatchError(res.error);
      }
    } catch {
      setMismatchError('Invalid numeric input for salary rate.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--accent-indigo)' }}>
      <div className="section-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Briefcase size={22} style={{ color: 'var(--accent-indigo)' }} />
          <h2 className="section-title">Pending Job Offer</h2>
        </div>
        <span className="badge badge-awaiting-hours">Action Required</span>
      </div>

      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        An employer has sealed a salary commitment on-chain. Before accepting, enter the agreed period rate to verify it matches their seal.
      </p>

      {mismatchError && (
        <div className="alert-box alert-error" style={{ marginBottom: '16px' }}>
          <AlertOctagon size={20} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
          <div>
            <div className="alert-error-title">❌ Verification Failed (Offer Mismatch)</div>
            <div>{mismatchError}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleAccept} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '220px' }}>
          <label className="form-label">Agreed Monthly/Hourly Salary Rate:</label>
          <input
            type="number"
            className="form-input"
            placeholder="e.g. 5000"
            value={enteredRate}
            onChange={(e) => setEnteredRate(e.target.value)}
            disabled={submitting || loading}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !enteredRate || loading}
        >
          <CheckCircle size={16} />
          {submitting ? 'Verifying Seal...' : 'Accept Job Offer'}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setEnteredRate('4500')} // Intentionally wrong rate to trigger mismatch demo
          title="Try wrong amount (4,500) to test mismatch detection"
        >
          <HelpCircle size={14} /> Test Wrong Rate (4,500)
        </button>
      </form>

      <div className="form-help" style={{ marginTop: '12px' }}>
        💡 <strong>Try entering 5000</strong> for a valid acceptance, or test <strong>4500</strong> to see the zero-knowledge commitment check prevent a wrong contract seal.
      </div>
    </div>
  );
};
