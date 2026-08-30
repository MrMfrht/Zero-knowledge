import React, { useState } from 'react';
import { usePayroll } from '../context/PayrollContext.tsx';
import type { WriteResult } from '../context/PayrollContext.tsx';
import { WriteFailureAlert } from './WriteFailureAlert.tsx';
import type { Period } from '@nightshift/shared';
import { formatPeriod } from '@nightshift/shared';
import { X, CheckCircle2, ShieldAlert, AlertTriangle, ArrowRight } from 'lucide-react';

interface ConfirmPaymentModalProps {
  period: Period;
  onClose: () => void;
}

export const ConfirmPaymentModal: React.FC<ConfirmPaymentModalProps> = ({ period, onClose }) => {
  const { confirmPayment } = usePayroll();
  const [amountInput, setAmountInput] = useState<string>('5000');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [failure, setFailure] = useState<WriteResult | null>(null);
  const [successMsg, setSuccessMsg] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountInput.trim()) return;

    setSubmitting(true);
    setFailure(null);
    setSuccessMsg(false);

    try {
      const amountBigInt = BigInt(amountInput);
      const res = await confirmPayment(period, amountBigInt);

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
      setFailure({ success: false, error: 'Please enter a valid numeric payment amount.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-card modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={22} style={{ color: 'var(--accent-indigo)' }} />
            <h3 className="modal-title">Confirm Payment: {formatPeriod(period)}</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Enter the exact amount deposited into your bank account. The system will prove in Zero-Knowledge whether this matches your sealed salary contract without revealing your income.
        </p>

        {successMsg && (
          <div className="alert-box alert-success">
            <CheckCircle2 size={20} />
            <div>
              <strong>✅ Payment Confirmed!</strong> Zero-Knowledge proof generated and verified against sealed rate on-chain.
            </div>
          </div>
        )}

        <WriteFailureAlert failure={failure} />

        {failure?.isMismatch && (
          <div className="alert-box alert-error">
            <AlertTriangle size={24} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
            <div>
              <div className="alert-error-title">The Demo Moment — Intended Refusal</div>
              <div style={{ marginTop: '4px' }}>{failure.error}</div>
              <div style={{ marginTop: '8px', fontSize: '0.775rem', color: '#fda4af' }}>
                🛡️ <em>The contract refuses to record an underpayment as correct. This period remains permanently unconfirmed to auditors.</em>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Net Amount Received ({formatPeriod(period)}):</label>
            <input
              type="number"
              className="form-input"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="e.g. 5000"
              disabled={submitting || successMsg}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setAmountInput('4000')}
              disabled={submitting}
            >
              Test Underpayment (4,000)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setAmountInput('5000')}
              disabled={submitting}
            >
              Test Correct Salary (5,000)
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || successMsg}>
              {submitting ? 'Generating ZK Proof...' : 'Confirm Payment'}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
