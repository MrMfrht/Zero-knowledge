import React from 'react';
import type { WorkerRecord, Period } from '../types';


interface BoardProps {
  workers: WorkerRecord[];
  onWorkerClick: (workerKey: string) => void;
  periods: Period[];
}

/**
 * The main auditor board: workers and months with ✅ / ✗ / ⏳ status.
 * Large, bold, readable from across a room for projector display.
 */
export const Board: React.FC<BoardProps> = ({ workers, onWorkerClick, periods }) => {
  if (workers.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)' }}>
          No workers found yet. Board will populate as employment records are created.
        </p>
      </div>
    );
  }



  return (
    <div className="board-scroll">
      <table className="board-table">
        <thead>
          <tr>
            <th style={{ minWidth: '200px' }}>Worker</th>
            {periods.map((period) => (
              <th key={period} className="period-cell">
                {period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workers.map((worker) => (
            <tr
              key={worker.workerKey}
              className="worker-row"
              onClick={() => onWorkerClick(worker.workerKey)}
            >
              <td>
                <span className="worker-key">{worker.workerKey.slice(0, 12)}…</span>
              </td>
              {periods.map((period) => {
                const periodRecord = worker.periods.find((p) => p.period === period);
                const status = periodRecord?.status || 'pending';
                return (
                  <td key={`${worker.workerKey}-${period}`} className="period-cell">
                    <div className={`status-badge status-${status}`}>
                      {status === 'confirmed' && '✅'}
                      {status === 'unconfirmed' && '✗'}
                      {status === 'pending' && '⏳'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
