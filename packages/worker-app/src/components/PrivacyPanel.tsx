import React from 'react';
import { usePayroll } from '../context/PayrollContext.tsx';
import { Shield, Eye, Lock, Globe, Key, CheckCircle2, AlertTriangle, FileCode } from 'lucide-react';
import { formatPeriod } from '@nightshift/shared';

export const PrivacyPanel: React.FC = () => {
  const { record, activePersona } = usePayroll();

  const confirmedCount = record?.periods.filter((p) => p.status === 'confirmed').length ?? 0;
  const unconfirmedCount = record?.periods.filter((p) => p.status === 'unconfirmed').length ?? 0;

  return (
    <div className="glass-card privacy-panel">
      <div className="privacy-header">
        <Shield size={20} style={{ color: 'var(--accent-purple)' }} />
        <span>Privacy & Proof Boundary</span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Demonstrates Midnight’s selective disclosure: what strangers can read vs. what remains strictly on your device.
      </p>

      <div className="privacy-columns">
        {/* Left Column: Publicly Visible on Chain */}
        <div className="privacy-col col-public">
          <div className="privacy-col-title">
            <Globe size={16} /> On the Blockchain (Public)
          </div>

          <div className="privacy-item">
            <span className="privacy-item-label">Worker ID:</span>
            <span className="privacy-item-val mono-key">
              {record ? `${record.workerKey.slice(0, 10)}...` : 'Unknown'}
            </span>
          </div>

          <div className="privacy-item">
            <span className="privacy-item-label">Employment Status:</span>
            <span className="privacy-item-val" style={{ color: record?.active ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
              {record?.active ? 'Active Employee' : 'Inactive'}
            </span>
          </div>

          <div className="privacy-item">
            <span className="privacy-item-label">Joined Period:</span>
            <span className="privacy-item-val">
              {record?.joinedPeriod ? formatPeriod(record.joinedPeriod) : 'None'}
            </span>
          </div>

          <div className="privacy-item">
            <span className="privacy-item-label">Confirmed Periods:</span>
            <span className="privacy-item-val" style={{ color: 'var(--accent-emerald)' }}>
              <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
              {confirmedCount} period(s)
            </span>
          </div>

          {unconfirmedCount > 0 && (
            <div className="privacy-item">
              <span className="privacy-item-label">Unconfirmed Periods:</span>
              <span className="privacy-item-val" style={{ color: 'var(--accent-rose)' }}>
                <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
                {unconfirmedCount} period(s)
              </span>
            </div>
          )}

          <div className="privacy-item" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
            <span className="privacy-item-label">Public Salary Value:</span>
            <span className="privacy-item-val" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
              <Eye size={12} style={{ display: 'inline', marginRight: 4 }} />
              [ HIDDEN / NONE ]
            </span>
          </div>
        </div>

        {/* Right Column: Kept Private on Device */}
        <div className="privacy-col col-private">
          <div className="privacy-col-title">
            <Lock size={16} /> Never Leaves Your Device
          </div>

          <div className="privacy-item">
            <span className="privacy-item-label">Role Profile:</span>
            <span className="privacy-item-val" style={{ color: 'var(--accent-purple)' }}>
              {activePersona.name}
            </span>
          </div>

          <div className="privacy-item">
            <span className="privacy-item-label">Agreed Salary/Rate:</span>
            <span className="privacy-item-val" style={{ color: 'var(--accent-indigo)' }}>
              🔒 Local Device Storage
            </span>
          </div>

          <div className="privacy-item">
            <span className="privacy-item-label">Random Salt (Secret):</span>
            <span className="privacy-item-val">
              <Key size={12} style={{ display: 'inline', marginRight: 4 }} />
              Encrypted Local Store
            </span>
          </div>

          <div className="privacy-item">
            <span className="privacy-item-label">Zero-Knowledge Prover:</span>
            <span className="privacy-item-val" style={{ color: 'var(--accent-emerald)' }}>
              Client-Side (WASM)
            </span>
          </div>

          <div className="privacy-item">
            <span className="privacy-item-label">External Server Access:</span>
            <span className="privacy-item-val" style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>
              0 Secrets Sent
            </span>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.775rem' }}>
        <FileCode size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--accent-indigo)' }} />
        <strong>Rule 2 Enforced:</strong> Proofs are generated client-side. The server and employer only see cryptographic verification results, never your salary figure.
      </div>
    </div>
  );
};
