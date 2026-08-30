import React, { useState } from 'react';
import { usePayroll, PERSONAS } from '../context/PayrollContext.tsx';
import { ShieldCheck, RotateCcw, User, Sparkles, Wallet, UserPlus, Copy, Check } from 'lucide-react';
import { regenerateLocalSecret } from '@nightshift/api';

export const Header: React.FC = () => {
  const {
    activeWorkerKey,
    activePersona,
    live,
    backendLabel,
    setPersona,
    resetStore,
    loading,
    walletConnected,
    walletBusy,
    walletError,
    connectWallet,
    disconnectWallet,
  } = usePayroll();

  /**
   * Reloads rather than re-rendering. Identity is read once, at construction,
   * by `MidnightPayrollApi` and by the contract's `localSk()` witness; a
   * live-swapped secret would leave the page holding providers and cached
   * reads belonging to the previous person.
   */
  const [copiedKey, setCopiedKey] = useState(false);

  const copyWorkerKey = () => {
    void navigator.clipboard.writeText(activeWorkerKey).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    });
  };

  const newIdentity = () => {
    const confirmed = window.confirm(
      [
        'Generate a new identity?',
        '',
        'This browser gets a fresh secret, so you become a different worker on chain.',
        'Any employment, approved hours or payments recorded against your current',
        'identity stay on chain but stop being yours — this device will no longer be',
        'able to prove it is that person.',
        '',
        'Devnet only.',
      ].join(String.fromCharCode(10)),
    );
    if (!confirmed) return;
    regenerateLocalSecret();
    window.location.reload();
  };

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
            {/*
              The header shows a truncated key because the full one is 64 hex
              characters, but the employer needs all of it -- a `hire` against
              a mistyped key seals a commitment to a worker who does not
              exist, and the contract will never allow that row to be
              replaced. Copying it is the only safe way to move it.
            */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={copyWorkerKey}
              title={`Copy ${activeWorkerKey}`}
              style={{ padding: '0.25rem 0.5rem' }}
            >
              {copiedKey ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey ? 'Copied' : 'Copy'}
            </button>
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

        {/*
          Live only, because the mock signs nothing. The worker proves
          confirmPayment and proveContribution on their own device against
          their own secret -- that is the product, not a convenience -- so
          this app needs its own wallet and cannot borrow the employer's.
        */}
        {live && (
          <button
            className={walletConnected ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
            onClick={() => (walletConnected ? disconnectWallet() : connectWallet())}
            disabled={walletBusy}
            title={
              walletError ??
              (walletConnected
                ? 'Disconnect this wallet'
                : 'Connect a Midnight wallet to sign and prove on this device')
            }
          >
            <Wallet size={14} />
            {walletBusy ? 'Connecting…' : walletConnected ? 'Wallet Connected' : 'Connect Wallet'}
          </button>
        )}

        {/*
          Devnet only, and gated on that rather than merely hidden: a hired
          worker key can never be hired again, so running the demo twice needs
          an identity with no history. Against a real network this button
          would be a way to silently abandon your own employment record.
        */}
        {live && import.meta.env.VITE_NETWORK_ID === 'undeployed' && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={newIdentity}
            title="Devnet only. Replaces this browser's secret — you become a different worker and lose access to this one's history."
          >
            <UserPlus size={14} />
            New Identity
          </button>
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
