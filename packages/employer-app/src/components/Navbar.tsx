import React from 'react';
import { Users, UserPlus, Clock, CreditCard, Lock, ShieldCheck, Wallet, ChevronRight } from 'lucide-react';
import { DEMO_EMPLOYER } from '@nightshift/api';

export type TabType = 'team' | 'hire' | 'hours' | 'pay';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  walletConnected: boolean;
  setWalletConnected: (connected: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  walletConnected,
  setWalletConnected,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 shadow-lg shadow-emerald-950/40 ring-1 ring-white/20">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-lg">NightShift</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                  Employer Portal
                </span>
              </div>
              <p className="text-xs text-slate-400">Private Payroll on Midnight Network</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 rounded-xl bg-slate-900/90 p-1.5 border border-slate-800">
            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'team'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Team List</span>
            </button>

            <button
              onClick={() => setActiveTab('hire')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'hire'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Hire Employee</span>
            </button>

            <button
              onClick={() => setActiveTab('hours')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'hours'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Approve Hours</span>
            </button>

            <button
              onClick={() => setActiveTab('pay')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'pay'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>Pay Worker</span>
            </button>
          </nav>

          {/* Right side status & Wallet Button */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 rounded-lg bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 border border-slate-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Actor:</span>
              <span className="font-mono text-emerald-400 font-semibold">{DEMO_EMPLOYER.slice(0, 10)}…</span>
            </div>

            <button
              onClick={() => setWalletConnected(!walletConnected)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${
                walletConnected
                  ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                  : 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40 hover:bg-indigo-900/60'
              }`}
            >
              <Wallet className="h-4 w-4" />
              <span>{walletConnected ? 'Midnight Wallet (Lace)' : 'Connect Wallet'}</span>
              <span className={`h-2 w-2 rounded-full ${walletConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Nav */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-2 border-t border-slate-900 scrollbar-none">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              activeTab === 'team' ? 'bg-emerald-600 text-white' : 'text-slate-400 bg-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Team List
          </button>
          <button
            onClick={() => setActiveTab('hire')}
            className={`flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              activeTab === 'hire' ? 'bg-emerald-600 text-white' : 'text-slate-400 bg-slate-900'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" /> Hire
          </button>
          <button
            onClick={() => setActiveTab('hours')}
            className={`flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              activeTab === 'hours' ? 'bg-emerald-600 text-white' : 'text-slate-400 bg-slate-900'
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> Approve Hours
          </button>
          <button
            onClick={() => setActiveTab('pay')}
            className={`flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              activeTab === 'pay' ? 'bg-emerald-600 text-white' : 'text-slate-400 bg-slate-900'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" /> Pay
          </button>
        </div>

      </div>
    </header>
  );
};
