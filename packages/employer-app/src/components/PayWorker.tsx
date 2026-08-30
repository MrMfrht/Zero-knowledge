import React, { useState } from 'react';
import { CreditCard, Send, ShieldCheck, AlertCircle, Sparkles, Wallet } from 'lucide-react';
import { DEMO_KARIM, DEMO_DANA, DEMO_SAM } from '@nightshift/api';
import type { PayrollApi, TransactionStatus } from '@nightshift/api';

interface PayWorkerProps {
  api: PayrollApi;
  walletConnected: boolean;
  onConnectWallet: () => void;
  initialWorkerKey?: string | undefined;
  onPaymentSent: (workerKey: string, amount: string, period: string) => void;
}

export const PayWorker: React.FC<PayWorkerProps> = ({
  api,
  walletConnected,
  onConnectWallet,
  initialWorkerKey,
  onPaymentSent,
}) => {
  const [workerKey, setWorkerKey] = useState(initialWorkerKey || DEMO_KARIM);
  const [period, setPeriod] = useState('2026-04');
  const [amountInput, setAmountInput] = useState('5000');
  const [stage, setStage] = useState<TransactionStatus['stage'] | 'idle'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<{
    workerKey: string;
    amount: string;
    period: string;
    txId: string | undefined;
    timestamp: string;
  } | null>(null);

  const isSending = stage !== 'idle' && stage !== 'confirmed' && stage !== 'failed';

  const handleSendPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // payWorker() genuinely throws with no wallet connected against the
    // real MidnightPayrollApi — prompt for it here rather than letting the
    // call fail. Against the mock this just flips walletConnected to true.
    if (!walletConnected) {
      onConnectWallet();
      setError('Connect a wallet first, then send the payment.');
      return;
    }

    setStage('signing');
    try {
      const { txId } = await api.payWorker({
        workerKey: workerKey.trim(),
        amount: BigInt(amountInput.trim() || '0'),
        onStatus: (status) => setStage(status.stage),
      });

      setLastPayment({
        workerKey: workerKey.trim(),
        amount: amountInput.trim(),
        period: period.trim(),
        txId,
        timestamp: new Date().toLocaleTimeString(),
      });
      onPaymentSent(workerKey.trim(), amountInput.trim(), period.trim());
    } catch (err) {
      setStage('failed');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const selectPresetWorker = (key: string, defaultAmount: string) => {
    setWorkerKey(key);
    setAmountInput(defaultAmount);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-emerald-400" />
            Send Private Shielded Payment
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            A direct wallet-to-wallet transfer of shielded NIGHT — it does not touch the
            contract at all. <code className="text-slate-500">confirmPayment</code> (in the
            worker app) is the separate step that checks it against the sealed rate.
          </p>
        </div>
      </div>

      {!walletConnected && (
        <div className="rounded-xl bg-indigo-950/40 border border-indigo-500/30 p-4 text-xs text-indigo-200 flex items-center gap-3">
          <Wallet className="h-4 w-4 text-indigo-400 shrink-0" />
          <span>
            No wallet connected. This calls <code>payWorker()</code> for real —
            connect one before sending.
          </span>
        </div>
      )}

      {/* Demo Guidance Alert */}
      <div className="rounded-xl bg-purple-950/40 border border-purple-500/30 p-4 text-xs text-purple-200 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-purple-300">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span>Demo Feature: Editable Payment Amount</span>
        </div>
        <p className="text-purple-200/80 leading-relaxed">
          The payment amount input is intentionally editable so you can perform the live
          underpayment demonstration! Try sending <strong>4,000</strong> when{' '}
          <strong>5,000</strong> was sealed. When the worker tries to confirm it, their app
          will refuse — the mismatch is the product working, not a bug.
        </p>
      </div>

      {/* Preset Demo Selection */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
          Quick Demo Presets:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => selectPresetWorker(DEMO_KARIM, '5000')}
            className={`p-3 rounded-xl border text-left transition ${
              workerKey === DEMO_KARIM
                ? 'bg-emerald-950/40 border-emerald-500 text-white'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-xs text-slate-200">Karim (Salaried)</div>
            <div className="text-xs text-slate-400">Target: 5000 NIGHT</div>
          </button>

          <button
            type="button"
            onClick={() => selectPresetWorker(DEMO_DANA, '3995')}
            className={`p-3 rounded-xl border text-left transition ${
              workerKey === DEMO_DANA
                ? 'bg-emerald-950/40 border-emerald-500 text-white'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-xs text-slate-200">Dana (Hourly)</div>
            <div className="text-xs text-slate-400">Target: 47 hrs × 85</div>
          </button>

          <button
            type="button"
            onClick={() => selectPresetWorker(DEMO_SAM, '4000')}
            className={`p-3 rounded-xl border text-left transition ${
              workerKey === DEMO_SAM
                ? 'bg-rose-950/40 border-rose-500 text-white'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-xs text-amber-300">Sam (Underpay Demo)</div>
            <div className="text-xs text-amber-400/80">Send 4000 (Sealed: 4200)</div>
          </button>
        </div>
      </div>

      {/* Main Payment Form */}
      <form onSubmit={handleSendPayment} className="glass-panel p-6 space-y-6">

        {/* Worker Key */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">
            Recipient's Worker Key
          </label>
          <input
            type="text"
            value={workerKey}
            onChange={(e) => setWorkerKey(e.target.value)}
            required
            placeholder="0x7f3a..."
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-100 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Period */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              Pay Period
            </label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              required
              placeholder="2026-04"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-100 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
            />
          </div>

          {/* Amount (Editable) */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              Transfer Amount (NIGHT)
            </label>
            <div className="relative">
              <input
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                required
                min="1"
                placeholder="5000"
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-slate-100 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
              />
              <span className="absolute right-4 top-3.5 text-xs text-slate-400 font-mono">NIGHT</span>
            </div>
          </div>
        </div>

        {/* Demo Quick Adjust Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400">Quick adjust:</span>
          <button
            type="button"
            onClick={() => setAmountInput('5000')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700"
          >
            5000 (Correct)
          </button>
          <button
            type="button"
            onClick={() => setAmountInput('4000')}
            className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 text-xs font-mono text-amber-300 border border-amber-500/40"
          >
            4000 (Underpayment Demo)
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-rose-950/40 border border-rose-500/30 p-3 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSending}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 py-3.5 px-6 font-semibold text-white shadow-lg hover:from-emerald-500 hover:to-indigo-500 transition disabled:opacity-50"
        >
          {isSending ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              {stageLabel(stage)}
            </span>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Send Private Payment ({amountInput} NIGHT)</span>
            </>
          )}
        </button>
      </form>

      {/* Payment Confirmation Log */}
      {lastPayment && (
        <div className="glass-panel p-6 border-emerald-500/40 bg-emerald-950/20 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="h-5 w-5" />
              <span>Shielded Private Transfer Executed</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">{lastPayment.timestamp}</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Recipient:</span>
              <span className="text-emerald-300">{lastPayment.workerKey}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Amount Transferred:</span>
              <span className="text-white font-bold">{lastPayment.amount} NIGHT</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Pay Period:</span>
              <span className="text-slate-200">{lastPayment.period}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Tx id:</span>
              <span className="text-slate-400">
                {lastPayment.txId ? `${lastPayment.txId.slice(0, 16)}...` : 'not reported (see PayrollApi docs)'}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 pt-2 italic">
            The payment was sent directly wallet to wallet. The contract only learns whether
            it was correct when the worker runs <code>confirmPayment</code> in their own app.
          </p>
        </div>
      )}
    </div>
  );
};

function stageLabel(stage: TransactionStatus['stage'] | 'idle'): string {
  switch (stage) {
    case 'signing':
      return 'Waiting for wallet signature...';
    case 'proving':
      return 'Generating shielded ZK proof...';
    case 'submitting':
      return 'Submitting transaction...';
    case 'pending':
      return 'Waiting for confirmation...';
    default:
      return 'Sending...';
  }
}
