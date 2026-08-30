import React, { useState } from 'react';
import { usePayroll } from '../context/PayrollContext.tsx';
import type { WriteResult } from '../context/PayrollContext.tsx';
import { WriteFailureAlert } from './WriteFailureAlert.tsx';
import { Briefcase, CheckCircle, AlertOctagon, HelpCircle } from 'lucide-react';

/**
 * Where a worker turns an offer they were sent privately into an on-chain
 * acceptance.
 *
 * The salt input is the whole point, and it exists because of a real property
 * of the design rather than a missing feature. `agreedRate` holds
 * `persistentCommit(rate, salt)` — a hash. The rate and salt that open it are
 * never written to the chain and never pass through the api, so a worker's
 * device has no way to learn them by reading anything. The employer has to
 * send them out-of-band, and this is where they arrive.
 *
 * That is also why the card renders while `offer` is null. Against the mock,
 * the offer object carries its own salt and only the rate is asked for.
 * Against a real contract, `getMyOffer()` correctly throws
 * `OfferNotYetReceivedError` for exactly the reason above — so keying the
 * card's visibility off `offer` meant the live path could never accept
 * anything at all.
 */
export const AcceptOfferCard: React.FC = () => {
  const { offer, record, live, acceptOffer, loading } = usePayroll();
  const [enteredRate, setEnteredRate] = useState<string>('');
  const [enteredSalt, setEnteredSalt] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [failure, setFailure] = useState<WriteResult | null>(null);

  // The mock hands over a full offer. Live, nothing can — see above.
  const saltFromOffer = offer?.salt ?? null;
  const needsSalt = saltFromOffer === null;

  // Already employed means `acceptHire` would assert "you have already
  // accepted this offer"; showing the form would only invite a wasted proof.
  if (record?.active) return null;
  if (!offer && !live) return null;

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredRate.trim()) return;

    const salt = saltFromOffer ?? enteredSalt.trim();
    if (!salt) return;

    setSubmitting(true);
    setFailure(null);

    try {
      const rateBigInt = BigInt(enteredRate);
      const res = await acceptOffer(rateBigInt, salt);
      if (!res.success) {
        setFailure(res);
      }
    } catch {
      setFailure({ success: false, error: 'Invalid numeric input for salary rate.' });
    } finally {
      setSubmitting(false);
    }
  };

  const saltLooksWrong = needsSalt && enteredSalt.trim() !== '' && !/^(0x)?[0-9a-fA-F]{64}$/.test(enteredSalt.trim());

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
        {needsSalt
          ? 'Your employer sealed a salary commitment on-chain and sent you the rate and salt privately. Enter both to prove you accept that exact figure. Neither value is readable from the chain — that is what keeps your salary private.'
          : 'An employer has sealed a salary commitment on-chain. Before accepting, enter the agreed period rate to verify it matches their seal.'}
      </p>

      {failure?.isMismatch && (
        <div className="alert-box alert-error" style={{ marginBottom: '16px' }}>
          <AlertOctagon size={20} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
          <div>
            <div className="alert-error-title">❌ Verification Failed (Offer Mismatch)</div>
            <div>{failure.error}</div>
          </div>
        </div>
      )}

      <WriteFailureAlert failure={failure} />

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

        {needsSalt && (
          <div className="form-group" style={{ flex: 2, minWidth: '320px' }}>
            <label className="form-label">Salt from your employer (64 hex characters):</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x7bffd131…"
              value={enteredSalt}
              onChange={(e) => setEnteredSalt(e.target.value)}
              disabled={submitting || loading}
              style={{ fontFamily: 'monospace' }}
            />
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !enteredRate || loading || (needsSalt && !enteredSalt.trim())}
        >
          <CheckCircle size={16} />
          {submitting ? 'Verifying Seal...' : 'Accept Job Offer'}
        </button>

        {!needsSalt && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setEnteredRate('4500')} // Intentionally wrong rate to trigger mismatch demo
            title="Try wrong amount (4,500) to test mismatch detection"
          >
            <HelpCircle size={14} /> Test Wrong Rate (4,500)
          </button>
        )}
      </form>

      {saltLooksWrong && (
        <div className="form-help" style={{ marginTop: '12px', color: 'var(--accent-rose)' }}>
          A salt is 32 bytes — 64 hex characters, with or without a leading <code>0x</code>. Copy it
          exactly as your employer sent it.
        </div>
      )}

      <div className="form-help" style={{ marginTop: '12px' }}>
        {needsSalt ? (
          <>
            🔒 The rate and salt stay on this device. What reaches the chain is a proof that they
            open your employer&rsquo;s commitment — never the numbers themselves.
          </>
        ) : (
          <>
            💡 <strong>Try entering 5000</strong> for a valid acceptance, or test <strong>4500</strong>{' '}
            to see the zero-knowledge commitment check prevent a wrong contract seal.
          </>
        )}
      </div>
    </div>
  );
};
