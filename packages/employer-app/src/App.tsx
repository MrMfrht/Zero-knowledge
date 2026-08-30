import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPayrollApi, payrollApiConfigFromEnv, DEMO_EMPLOYER } from '@nightshift/api';
import { Navbar } from './components/Navbar';
import type { TabType } from './components/Navbar';
import { TeamList } from './components/TeamList';
import { HireForm } from './components/HireForm';
import { ApproveHours } from './components/ApproveHours';
import { PayWorker } from './components/PayWorker';
import { explainPayrollFailure } from './explainPayrollFailure';
import { ShieldCheck, Info, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('team');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [selectedWorkerKey, setSelectedWorkerKey] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [actorKey, setActorKey] = useState<string | null>(null);

  // Real contract if VITE_CONTRACT_ADDRESS is set, mock otherwise — the
  // decision lives in @nightshift/api so all three apps make it identically.
  // `actingAs` is the mock's demo persona and is ignored on chain, where
  // identity comes from this browser's own secret and nothing can override it.
  const { api, live, label } = useMemo(
    () => createPayrollApi({ ...payrollApiConfigFromEnv(import.meta.env), actingAs: DEMO_EMPLOYER }),
    [],
  );

  // Reflect the api's own wallet state rather than tracking a second,
  // disconnected copy of it here — this is the one change that keeps this
  // screen honest once MidnightPayrollApi replaces the mock (its
  // hire/approveHours/payWorker genuinely throw with no wallet connected).
  useEffect(() => {
    let cancelled = false;
    api
      .getWalletStatus()
      .then((status) => {
        if (!cancelled) setWalletConnected(status.connected);
      })
      // An unhandled rejection here would leave the header stuck on
      // "disconnected" with no explanation anywhere on screen.
      .catch((error: unknown) => {
        if (!cancelled) setWalletError(explainPayrollFailure(error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  /**
   * Resolves to the reason the wallet did not connect, or `null` on success.
   *
   * Returning the reason rather than only storing it lets a caller that is
   * mid-flow — PayWorker's send button — show it beside the control the
   * person just pressed, instead of only in the banner at the top of the page.
   */
  // Ask the api who this browser is ON THE CONTRACT. On a real chain that is
  // dappKey(localSk(), deploymentId) -- derived from a secret this browser
  // holds and which nothing can override -- so it is the only honest answer
  // to "who am I", and the value every employer circuit asserts against.
  useEffect(() => {
    let cancelled = false;
    api
      .getMyKey()
      .then((key) => {
        if (!cancelled) setActorKey(key);
      })
      .catch((error: unknown) => {
        console.error('getMyKey failed:', error);
        if (!cancelled) setActorKey(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const handleToggleWallet = useCallback(async (): Promise<string | null> => {
    setWalletBusy(true);
    setWalletError(null);
    try {
      if (walletConnected) {
        await api.disconnectWallet();
        setWalletConnected(false);
      } else {
        const status = await api.connectWallet();
        setWalletConnected(status.connected);
      }
      return null;
    } catch (error: unknown) {
      const { message } = explainPayrollFailure(error);
      setWalletError(message);
      return message;
    } finally {
      setWalletBusy(false);
    }
  }, [api, walletConnected]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  const handleNavigatePay = (workerKey: string) => {
    setSelectedWorkerKey(workerKey);
    setActiveTab('pay');
  };

  const handleNavigateHours = (workerKey: string) => {
    setSelectedWorkerKey(workerKey);
    setActiveTab('hours');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        walletConnected={walletConnected}
        walletBusy={walletBusy}
        onToggleWallet={handleToggleWallet}
        actorKey={actorKey}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

        {/*
          Which backend is behind this screen, stated on screen. A demo that is
          silently running on fixtures looks exactly like one running on chain,
          and that confusion is expensive to discover late.
        */}
        <div
          className={`mb-6 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            live
              ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300'
              : 'border-amber-500/40 bg-amber-500/5 text-amber-300'
          }`}
        >
          <Info className="h-4 w-4 shrink-0" />
          <span>
            {live
              ? `Live on Midnight — ${label}`
              : `Demo mode — ${label}. Set VITE_CONTRACT_ADDRESS to talk to a deployed contract.`}
          </span>
        </div>

        {/*
          Why the wallet is not connected, stated on screen. Before this
          existed the connect button rejected into an uncaught promise and the
          page showed nothing at all — the worst possible demo failure.
        */}
        {walletError && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="flex-1">{walletError}</span>
            <button
              type="button"
              onClick={() => setWalletError(null)}
              aria-label="Dismiss wallet error"
              className="shrink-0 text-rose-400 hover:text-rose-200 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-fade-in flex items-center gap-3 rounded-xl bg-slate-900 border border-emerald-500/40 p-4 shadow-2xl shadow-emerald-950/80 text-emerald-300 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'team' && (
          <TeamList
            api={api}
            onNavigatePay={handleNavigatePay}
            onNavigateHours={handleNavigateHours}
          />
        )}

        {activeTab === 'hire' && (
          <HireForm
            api={api}
            onSuccess={() => showToast('New employee salary commitment sealed on Midnight!')}
          />
        )}

        {activeTab === 'hours' && (
          <ApproveHours
            api={api}
            initialWorkerKey={selectedWorkerKey}
            onSuccess={() => showToast('Timesheet hours successfully approved on ledger!')}
          />
        )}

        {activeTab === 'pay' && (
          <PayWorker
            api={api}
            walletConnected={walletConnected}
            onConnectWallet={handleToggleWallet}
            initialWorkerKey={selectedWorkerKey}
            onPaymentSent={(workerKey, amount) => {
              showToast(`Private shielded NIGHT payment of ${amount} sent to ${workerKey.slice(0, 10)}...`);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>NightShift Employer Portal — Private Payroll with Public Proof</span>
          </div>
          <p className="text-slate-400">
            Powered by Midnight Zero-Knowledge Contracts
          </p>
        </div>
      </footer>
    </div>
  );
}
