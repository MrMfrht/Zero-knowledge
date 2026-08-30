import React, { useState } from 'react';
import { Clock, CheckCircle2, AlertCircle, Info, Sparkles, FileText } from 'lucide-react';
import type { PayrollApi } from '@nightshift/api';
import { explainPayrollFailure } from '../explainPayrollFailure';

interface ApproveHoursProps {
  api: PayrollApi;
  initialWorkerKey?: string | undefined;
  onSuccess: () => void;
}

export const ApproveHours: React.FC<ApproveHoursProps> = ({ api, initialWorkerKey, onSuccess }) => {
  const [workerKey, setWorkerKey] = useState(initialWorkerKey || '');
  const [period, setPeriod] = useState('2026-04');
  const [hoursInput, setHoursInput] = useState('47');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    try {
      const parsedHours = parseInt(hoursInput.trim(), 10);
      if (isNaN(parsedHours) || parsedHours <= 0) {
        throw new Error('Hours worked must be a positive integer.');
      }

      setLoading(true);
      await api.approveHours({
        workerKey: workerKey.trim(),
        period: period.trim(),
        hours: parsedHours,
      });

      setSuccessMsg(`Timesheet approved! Approved ${parsedHours} hours for period ${period} on Midnight ledger.`);
      onSuccess();
    } catch (error: unknown) {
      setError(explainPayrollFailure(error).message);
    } finally {
      // Runs on the wallet-missing path too, so the button never keeps
      // spinning over a failure the person can already read.
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Clock className="h-6 w-6 text-teal-400" />
            Approve Employee Timesheet
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Publish verified hours worked for a pay period. Required before worker confirmation.
          </p>
        </div>
      </div>

      {/* Concept Explainer */}
      <div className="glass-panel p-4 border-teal-500/30 bg-teal-950/20 flex items-start gap-3 text-xs text-teal-200">
        <Info className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-teal-300">Selective Disclosure Principle</p>
          <p className="text-teal-200/80 leading-relaxed">
            Hours worked are <strong>public on-chain</strong> — both parties already know the hours, and only the rate is sensitive. Salaried employees use <code>1</code> hour.
          </p>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleApprove} className="glass-panel p-6 space-y-6">
        
        {/* Worker Key */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">
            Worker's Identity Key (<code className="text-teal-400">WorkerKey</code>)
          </label>
          <input
            type="text"
            value={workerKey}
            onChange={(e) => setWorkerKey(e.target.value)}
            required
            placeholder="0x7f3a..."
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-100 font-mono focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Period Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              Pay Period (YYYY-MM)
            </label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              required
              pattern="^\d{4}-\d{2}$"
              placeholder="2026-04"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-100 font-mono focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition"
            />
            <p className="text-xs text-slate-400 mt-1">Format: 4-digit year + 2-digit month</p>
          </div>

          {/* Hours Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              Approved Hours Worked
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                required
                min="1"
                placeholder="47"
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-100 font-mono focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setHoursInput('1')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 shrink-0"
              >
                Salaried (1)
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-950/50 border border-rose-500/30 p-3.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/30 p-3.5 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 py-3.5 px-6 font-semibold text-white shadow-lg hover:from-teal-500 hover:to-indigo-500 transition disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Publishing Hours to Ledger...
            </span>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              <span>Approve Timesheet</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
