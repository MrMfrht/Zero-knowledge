import React, { useEffect, useState } from 'react';
import { Users, ShieldAlert, CheckCircle2, Clock, XCircle, RefreshCw, UserX, Lock, ShieldCheck, FileText } from 'lucide-react';
import type { PayrollApi, WorkerSummary } from '@nightshift/api';

interface TeamListProps {
  api: PayrollApi;
  onNavigatePay: (workerKey: string) => void;
  onNavigateHours: (workerKey: string) => void;
}

export const TeamList: React.FC<TeamListProps> = ({ api, onNavigatePay, onNavigateHours }) => {
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingWorker, setEndingWorker] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listWorkers();
      setWorkers(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load team list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleEndEmployment = async (workerKey: string) => {
    if (!confirm(`Are you sure you want to end employment for worker ${workerKey.slice(0, 10)}...?`)) {
      return;
    }
    setEndingWorker(workerKey);
    try {
      await api.endEmployment(workerKey);
      await fetchTeam();
    } catch (err: any) {
      alert(err?.message || 'Failed to end employment.');
    } finally {
      setEndingWorker(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-400" />
            Company Team Directory
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Overview of hired personnel, status, and verified payment periods.
          </p>
        </div>

        <button
          onClick={fetchTeam}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Team</span>
        </button>
      </div>

      {/* Critical Privacy Card (Rule #2) */}
      <div className="glass-panel p-4 border-indigo-500/30 bg-indigo-950/20 flex items-start gap-3">
        <Lock className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-semibold text-indigo-300 block">
            🔒 Salaries are intentionally hidden from this view
          </span>
          <p className="text-slate-300 leading-relaxed">
            The employer app <strong>does not possess or store employee salaries</strong>. Once committed, the rate is sealed into a zero-knowledge commitment on Midnight. Only the worker's device holds the private salt required to unseal their salary.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-950/50 border border-rose-500/30 p-4 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Team Cards / Table */}
      {loading ? (
        <div className="glass-panel p-12 text-center text-slate-400 space-y-3">
          <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium">Fetching verified team records from Midnight indexer...</p>
        </div>
      ) : workers.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 space-y-3">
          <Users className="h-10 w-10 text-slate-600 mx-auto" />
          <p className="text-base font-semibold text-slate-200">No Hired Workers Found</p>
          <p className="text-xs text-slate-400">Use the "Hire Employee" tab to issue your first sealed salary contract.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {workers.map((w) => (
            <div
              key={w.workerKey}
              className="glass-panel p-5 border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Worker Metadata */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    {w.workerKey}
                  </span>
                  {w.active ? (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                      Active Employee
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
                      Former Employee
                    </span>
                  )}
                </div>

                {/* Period Status Summary */}
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <strong>{w.confirmedPeriods}</strong> Confirmed Periods
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    <strong>{w.unconfirmedPeriods}</strong> Open / Pending
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                <button
                  onClick={() => onNavigateHours(w.workerKey)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-800 transition"
                >
                  <FileText className="h-3.5 w-3.5 text-teal-400" />
                  <span>Approve Hours</span>
                </button>

                <button
                  onClick={() => onNavigatePay(w.workerKey)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 text-xs font-medium border border-emerald-500/40 transition"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Pay Worker</span>
                </button>

                {w.active && (
                  <button
                    onClick={() => handleEndEmployment(w.workerKey)}
                    disabled={endingWorker === w.workerKey}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-500/30 transition disabled:opacity-50"
                  >
                    <UserX className="h-3.5 w-3.5 text-rose-400" />
                    <span>End Contract</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
