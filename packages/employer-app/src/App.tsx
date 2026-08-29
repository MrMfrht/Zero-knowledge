import React, { useState, useMemo } from 'react';
import { MockPayrollApi, DEMO_EMPLOYER } from '@nightshift/api';
import { Navbar } from './components/Navbar';
import type { TabType } from './components/Navbar';
import { TeamList } from './components/TeamList';
import { HireForm } from './components/HireForm';
import { ApproveHours } from './components/ApproveHours';
import { PayWorker } from './components/PayWorker';
import { ShieldCheck, Info, CheckCircle2, Heart } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('team');
  const [walletConnected, setWalletConnected] = useState(true);
  const [selectedWorkerKey, setSelectedWorkerKey] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);

  // Instantiating MockPayrollApi acting as DEMO_EMPLOYER per specification in tasks/04-employer-app.md
  const api = useMemo(() => {
    return new MockPayrollApi({ actingAs: DEMO_EMPLOYER });
  }, []);

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
        setWalletConnected={setWalletConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        
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
            initialWorkerKey={selectedWorkerKey}
            onPaymentSent={(workerKey, amount, period) => {
              showToast(`Private payment of ${amount} DUST sent to ${workerKey.slice(0, 10)}... for ${period}`);
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
