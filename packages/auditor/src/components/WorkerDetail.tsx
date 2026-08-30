import React from 'react';
import { CheckCircle2, AlertOctagon } from 'lucide-react';
import type { WorkerRecord } from '../types';
import { PrivacyNotice } from './PrivacyNotice';

interface WorkerDetailProps {
  worker: WorkerRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Worker detail modal: click a worker from the board to see their employment record.
 * Shows periods, confirmation status, and employment dates.
 * Never displays private data like salaries.
 */
export const WorkerDetail: React.FC<WorkerDetailProps> = ({ worker, isOpen, onClose }) => {
  if (!isOpen || !worker) {
    return null;
  }

  const unconfirmedPeriods = worker.periods.filter((p) => p.status === 'unconfirmed');
  const confirmedPeriods = worker.periods.filter((p) => p.status === 'confirmed');
  const pendingPeriods = worker.periods.filter((p) => p.status === 'pending');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Worker {worker.workerKey.slice(0, 12)}…</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Employment Record Section */}
        <div className="record-section">
          <h3>Employment Record</h3>
          <div className="record-info">
            <div className="record-row">
              <span className="record-label">Employed since:</span>
              <span className="record-value">{worker.employmentStart}</span>
            </div>
            {worker.employmentEnd && (
              <div className="record-row">
                <span className="record-label">Employment ended:</span>
                <span className="record-value">{worker.employmentEnd}</span>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Summary */}
        <div className="record-section">
          <h3>Payment Confirmation Summary</h3>
          <div className="record-info">
            <div className="record-row">
              <span className="record-label">
                <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Confirmed months:
              </span>
              <span className="record-value">{confirmedPeriods.length}</span>
            </div>
            {unconfirmedPeriods.length > 0 && (
              <div className="record-row">
                <span className="record-label">
                  <AlertOctagon
                    size={16}
                    style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--color-unconfirmed)' }}
                  />
                  Unconfirmed months:
                </span>
                <span className="record-value" style={{ color: 'var(--color-unconfirmed)' }}>
                  {unconfirmedPeriods.length}
                </span>
              </div>
            )}
            {pendingPeriods.length > 0 && (
              <div className="record-row">
                <span className="record-label">Pending periods:</span>
                <span className="record-value">{pendingPeriods.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Unconfirmed Periods Detail */}
        {unconfirmedPeriods.length > 0 && (
          <div className="record-section">
            <h3 style={{ color: 'var(--color-unconfirmed)' }}>Unconfirmed Periods</h3>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.375rem', borderLeft: '3px solid var(--color-unconfirmed)' }}>
              <p>
                The worker did not confirm receiving the agreed amount. Either they were not paid,
                or they were paid the wrong amount.
              </p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                The agreed salary remains sealed and is not readable by anyone, including this page.
              </p>
            </div>
            <div className="record-info">
              {unconfirmedPeriods.map((period) => (
                <div key={period.period} className="record-row">
                  <span className="record-label">{period.period}</span>
                  <span className="record-value" style={{ color: 'var(--color-unconfirmed)' }}>
                    ✗ Not confirmed
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmed Periods (if any) */}
        {confirmedPeriods.length > 0 && (
          <div className="record-section">
            <h3 style={{ color: 'var(--color-confirmed)' }}>Confirmed Periods</h3>
            <div className="record-info">
              {confirmedPeriods.slice(0, 5).map((period) => (
                <div key={period.period} className="record-row">
                  <span className="record-label">{period.period}</span>
                  <span className="record-value" style={{ color: 'var(--color-confirmed)' }}>
                    ✅ Confirmed
                  </span>
                </div>
              ))}
              {confirmedPeriods.length > 5 && (
                <div className="record-row">
                  <span className="record-label">… and {confirmedPeriods.length - 5} more</span>
                  <span className="record-value" style={{ color: 'var(--color-confirmed)' }}>
                    ✅
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Privacy Notice */}
        <div style={{ marginTop: '1.5rem' }}>
          <PrivacyNotice />
        </div>
      </div>
    </div>
  );
};
