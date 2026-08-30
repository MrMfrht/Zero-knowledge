import React, { useState } from 'react';
import { UserPlus, AlertTriangle, Lock, Copy, Check, Sparkles, Shield, KeyRound, ExternalLink } from 'lucide-react';
import type { PayrollApi, Offer } from '@nightshift/api';
import { explainPayrollFailure } from '../explainPayrollFailure';

interface HireFormProps {
  api: PayrollApi;
  onSuccess: () => void;
}

export const HireForm: React.FC<HireFormProps> = ({ api, onSuccess }) => {
  const [workerKey, setWorkerKey] = useState('0x4a8c9e71b2d3f45a67890123456789abcdef0123');
  const [payType, setPayType] = useState<'salaried' | 'hourly'>('salaried');
  const [salaryInput, setSalaryInput] = useState('5000');
  const [expectedHoursInput, setExpectedHoursInput] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOffer, setCreatedOffer] = useState<Offer | null>(null);
  const [copied, setCopied] = useState(false);

  const handleHire = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedOffer(null);

    try {
      const parsedRate = BigInt(salaryInput.trim());
      if (parsedRate <= 0n) {
        throw new Error('Salary rate must be greater than zero.');
      }

      const parsedHours = payType === 'salaried' ? 1 : parseInt(expectedHoursInput.trim(), 10);
      if (isNaN(parsedHours) || parsedHours <= 0) {
        throw new Error('Expected hours must be at least 1.');
      }

      setLoading(true);

      const offer = await api.hire({
        workerKey: workerKey.trim(),
        ratePerPeriod: parsedRate,
        expectedHours: parsedHours,
      });

      setCreatedOffer(offer);
      onSuccess();
    } catch (error: unknown) {
      setError(explainPayrollFailure(error).message);
    } finally {
      // Runs on the wallet-missing path too, so the button never keeps
      // spinning over a failure the person can already read.
      setLoading(false);
    }
  };

  const copyOfferData = () => {
    if (!createdOffer) return;
    const textToCopy = JSON.stringify({
      workerKey: createdOffer.workerKey,
      ratePerPeriod: createdOffer.ratePerPeriod.toString(),
      salt: createdOffer.salt,
    }, null, 2);

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-emerald-400" />
            Hire New Employee
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Lock an agreed salary into a sealed, immutable cryptographic commitment on the Midnight blockchain.
          </p>
        </div>
      </div>

      {/* Warning Box */}
      <div className="rounded-xl bg-amber-950/40 border border-amber-500/30 p-4 flex items-start gap-3 text-amber-200 text-sm">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-300">⚠️ Once sealed, this salary cannot be changed.</p>
          <p className="text-amber-200/80 leading-relaxed">
            The salary is permanently committed to the blockchain as an unreadable hash. Neither the employer nor Midnight can edit it later. The worker must confirm this exact number to receive payments.
          </p>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleHire} className="glass-panel p-6 space-y-6">
        
        {/* Worker Key Input */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">
            Worker's Midnight Identity Key (<code className="text-emerald-400">WorkerKey</code>)
          </label>
          <input
            type="text"
            value={workerKey}
            onChange={(e) => setWorkerKey(e.target.value)}
            required
            placeholder="0x7f3a..."
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-100 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
          />
          <p className="text-xs text-slate-400 mt-1">
            This is the worker's private identity commitment (not a name or raw wallet address).
          </p>
        </div>

        {/* Pay Type Selector */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => { setPayType('salaried'); setExpectedHoursInput('1'); }}
            className={`p-4 rounded-xl border text-left transition-all ${
              payType === 'salaried'
                ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500/50'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-sm text-slate-100">Salaried (Fixed)</div>
            <div className="text-xs text-slate-400 mt-1">Fixed monthly compensation. Hours = 1.</div>
          </button>

          <button
            type="button"
            onClick={() => setPayType('hourly')}
            className={`p-4 rounded-xl border text-left transition-all ${
              payType === 'hourly'
                ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500/50'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-sm text-slate-100">Hourly Rate</div>
            <div className="text-xs text-slate-400 mt-1">Rate per hour. Hours approved monthly.</div>
          </button>
        </div>

        {/* Salary / Rate Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              {payType === 'salaried' ? 'Monthly Salary (NIGHT / Units)' : 'Hourly Rate (NIGHT / Units)'}
            </label>
            <div className="relative">
              <input
                type="number"
                value={salaryInput}
                onChange={(e) => setSalaryInput(e.target.value)}
                required
                min="1"
                placeholder="5000"
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-100 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
              />
              <span className="absolute right-4 top-3.5 text-xs text-slate-400 font-mono">NIGHT</span>
            </div>
          </div>

          {payType === 'hourly' && (
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Standard Expected Hours / Month
              </label>
              <input
                type="number"
                value={expectedHoursInput}
                onChange={(e) => setExpectedHoursInput(e.target.value)}
                required
                min="1"
                placeholder="160"
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-100 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-rose-950/50 border border-rose-500/30 p-3.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 py-3.5 px-6 font-semibold text-white shadow-lg shadow-emerald-950/50 hover:from-emerald-500 hover:to-indigo-500 transition-all disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Sealing Salary Commitment on Midnight...
            </span>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              <span>Seal and Send Offer</span>
            </>
          )}
        </button>
      </form>

      {/* Offer Result Modal / Card */}
      {createdOffer && (
        <div className="glass-panel p-6 border-emerald-500/40 bg-emerald-950/20 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Sparkles className="h-5 w-5" />
              <span>Salary Commitment Sealed Successfully!</span>
            </div>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
              On-Chain Sealed
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-400 block mb-1">Public On-Chain Commitment (Hash):</span>
              <code className="block w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-300 break-all">
                {createdOffer.commitment}
              </code>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400 block">Agreed Rate per Period:</span>
                <span className="text-sm font-semibold text-slate-100 font-mono">{createdOffer.ratePerPeriod.toString()} NIGHT</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400 block">Private Offer Salt:</span>
                <span className="text-xs font-mono text-amber-300 break-all">{createdOffer.salt}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/50 border border-indigo-500/30 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Direct Worker Share Instructions:
              </p>
              <p className="text-slate-400">
                Send both <code className="text-amber-300">ratePerPeriod</code> ({createdOffer.ratePerPeriod.toString()}) and <code className="text-amber-300">salt</code> to the worker directly (via private offer letter). They cannot accept without both.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={copyOfferData}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Offer Credentials Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Private Offer Credentials for Worker</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
