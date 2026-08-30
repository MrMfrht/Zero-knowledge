import React from 'react';
import type { WriteResult } from '../context/PayrollContext.tsx';
import { AlertOctagon, Wallet } from 'lucide-react';

/**
 * The visible half of the "a button did nothing" fix.
 *
 * Every write in this app can fail for a reason that is not a mismatch — most
 * often because this browser has no Midnight wallet, so the transaction was
 * never signed. Mismatches keep their own bespoke boxes, because refusing an
 * untrue claim is the product and must not be styled as a crash.
 */
export const WriteFailureAlert: React.FC<{ failure: WriteResult | null }> = ({ failure }) => {
  if (!failure || failure.success || failure.isMismatch || !failure.error) {
    return null;
  }

  const title = failure.needsWallet ? 'No wallet connected' : 'Could not complete this action';

  return (
    <div className="alert-box alert-error" style={{ marginBottom: '16px' }}>
      {failure.needsWallet ? (
        <Wallet size={20} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
      ) : (
        <AlertOctagon size={20} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
      )}
      <div>
        <div className="alert-error-title">{title}</div>
        <div style={{ marginTop: '4px' }}>{failure.error}</div>
      </div>
    </div>
  );
};
