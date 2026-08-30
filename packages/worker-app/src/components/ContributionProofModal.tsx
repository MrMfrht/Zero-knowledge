import React, { useState } from 'react';
import { usePayroll } from '../context/PayrollContext.tsx';
import type { WriteResult } from '../context/PayrollContext.tsx';
import { WriteFailureAlert } from './WriteFailureAlert.tsx';
import type { Period } from '@nightshift/shared';
import { formatPeriod } from '@nightshift/shared';
import { X, Award, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ContributionProofModalProps {
  period: Period;
  onClose: () => void;
}

export const ContributionProofModal: React.FC<ContributionProofModalProps> = ({ period, onClose }) => {
  const { proveContribution } = usePayroll();
  const [declaredInput, setDeclaredInput] = useState<string>('1250');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [failure, setFailure] = useState<WriteResult | null>(null);
  const [successMsg, setSuccessMsg] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declaredInput.trim()) return;

    setSubmitting(true);
    setFailure(null);
    setSuccessMsg(false);

    try {
      const declaredBigInt = BigInt(declaredInput);
      const res = await proveContribution(period, declaredBigInt);

      if (res.success) {
        setSuccessMsg(true);
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        // Every unsuccessful result lands here, mismatch or not. Filtering on
        // `isMismatch` was what made a missing wallet look like a dead button.
        setFailure(res);
      }
    } catch {
      setFailure({ success: false, error: 'Please enter a valid numeric contribution amount.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-card modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={22} style={{ color: 'var(--accent-purple)' }} />
            <h3 className="modal-title">NSSF / Pension Proof ({formatPeriod(period)})</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Verify that your employer's reported pension contribution (25%) matches your real committed salary in Zero-Knowledge.
        </p>

        {successMsg && (
          <div className="alert-box alert-success">
            <CheckCircle2 size={20} />
            <div>
              <strong>✅ Social Security Verified!</strong> Proof attached to public record without exposing your exact income.
            </div>
          </div>
        )}

        <WriteFailureAlert failure={failure} />

        {failure?.isMismatch && (
          <div className="alert-box alert-error">
            <AlertTriangle size={24} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
            <div>
              <div className="alert-error-title">Verification Refused</div>
              <div style={{ marginTop: '4px' }}>{failure.error}</div>
              <div style={{ marginTop: '8px', fontSize: '0.775rem', color: '#fda4af' }}>
                ⚠️ <em>The employer declared a contribution that does not match 25% of your sealed salary agreement.</em>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Declared Contribution Amount (25% rate):</label>
            <input
              type="number"
              className="form-input"
              value={declaredInput}
              onChange={(e) => setDeclaredInput(e.target.value)}
              placeholder="e.g. 1250"
              disabled={submitting || successMsg}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDeclaredInput('1000')}
              disabled={submitting}
            >
              Test Under-declared (1,000)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDeclaredInput('1250')}
              disabled={submitting}
            >
              Test Valid 25% (1,250)
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || successMsg}>
              <ShieldCheck size={16} />
              {submitting ? 'Verifying 25% Zero-Knowledge...' : 'Prove Contribution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
