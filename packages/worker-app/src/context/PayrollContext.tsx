import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  MockPayrollApi,
  DEMO_KARIM,
  DEMO_DANA,
  DEMO_SAM,
  resetMockStore,
  OfferMismatchError,
  PaymentMismatchError,
  ContributionMismatchError,
} from '@nightshift/api';
import type {
  EmploymentRecord,
  Offer,
  Period,
  WorkerKey,
} from '@nightshift/shared';

export interface PersonaOption {
  key: WorkerKey;
  name: string;
  role: string;
  description: string;
}

export const PERSONAS: PersonaOption[] = [
  {
    key: DEMO_KARIM,
    name: 'Karim',
    role: 'Full-time Salaried (5,000 / mo)',
    description: 'All 4 months confirmed paid & verified',
  },
  {
    key: DEMO_DANA,
    name: 'Dana',
    role: 'Hourly Contractor (85 / hr)',
    description: 'Variable hours, latest month (April) awaiting confirmation',
  },
  {
    key: DEMO_SAM,
    name: 'Sam',
    role: 'Salaried (4,200 / mo)',
    description: 'March period is UNCONFIRMED (The Demo Moment)',
  },
  {
    key: '0x0000000000000000000000000000000000000000000000000000000000000099',
    name: 'New Candidate',
    role: 'Pending Job Offer',
    description: 'Received a sealed offer from Cedar Café',
  },
];

interface PayrollContextType {
  activeWorkerKey: WorkerKey;
  activePersona: PersonaOption;
  record: EmploymentRecord | null;
  offer: Offer | null;
  loading: boolean;
  error: string | null;
  setPersona: (key: WorkerKey) => void;
  refresh: () => Promise<void>;
  resetStore: () => Promise<void>;
  acceptOffer: (ratePerPeriod: bigint, salt: string) => Promise<{ success: boolean; error?: string }>;
  confirmPayment: (period: Period, amountReceived: bigint) => Promise<{ success: boolean; isMismatch?: boolean; error?: string }>;
  proveContribution: (period: Period, declared: bigint) => Promise<{ success: boolean; isMismatch?: boolean; error?: string }>;
}

const PayrollContext = createContext<PayrollContextType | undefined>(undefined);

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeWorkerKey, setActiveWorkerKey] = useState<WorkerKey>(DEMO_KARIM);
  const [api, setApi] = useState<MockPayrollApi>(() => new MockPayrollApi({ actingAs: DEMO_KARIM }));
  const [record, setRecord] = useState<EmploymentRecord | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activePersona = PERSONAS.find((p) => p.key === activeWorkerKey) || {
    key: activeWorkerKey,
    name: 'Custom Worker',
    role: 'Worker',
    description: 'Active session',
  };

  const loadData = useCallback(async (currentApi: MockPayrollApi, workerKey: WorkerKey) => {
    setLoading(true);
    setError(null);
    try {
      const rec = await currentApi.getEmploymentRecord(workerKey);
      setRecord(rec);

      const pendingOffer = await currentApi.getMyOffer();
      setOffer(pendingOffer);
    } catch (err) {
      console.error('Failed to load payroll record:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch employment record');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const newApi = new MockPayrollApi({ actingAs: activeWorkerKey });
    setApi(newApi);
    loadData(newApi, activeWorkerKey);
  }, [activeWorkerKey, loadData]);

  const setPersona = (key: WorkerKey) => {
    setActiveWorkerKey(key);
  };

  const refresh = async () => {
    await loadData(api, activeWorkerKey);
  };

  const resetStore = async () => {
    resetMockStore();
    await refresh();
  };

  const acceptOffer = async (ratePerPeriod: bigint, salt: string) => {
    try {
      await api.acceptOffer({ ratePerPeriod, salt });
      await refresh();
      return { success: true };
    } catch (err) {
      if (err instanceof OfferMismatchError) {
        return {
          success: false,
          error: 'The sealed amount does not match what you entered. Do not accept — contact your employer.',
        };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to accept offer',
      };
    }
  };

  const confirmPayment = async (period: Period, amountReceived: bigint) => {
    try {
      await api.confirmPayment({ period, amountReceived });
      await refresh();
      return { success: true };
    } catch (err) {
      if (err instanceof PaymentMismatchError) {
        await refresh();
        return {
          success: false,
          isMismatch: true,
          error: 'Cannot confirm. The amount you received does not match your agreed salary. This period stays unconfirmed on the public record.',
        };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Confirmation failed',
      };
    }
  };

  const proveContribution = async (period: Period, declared: bigint) => {
    try {
      await api.proveContribution({ period, declared });
      await refresh();
      return { success: true };
    } catch (err) {
      if (err instanceof ContributionMismatchError) {
        return {
          success: false,
          isMismatch: true,
          error: 'The declared contribution was not calculated on your real salary.',
        };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Contribution verification failed',
      };
    }
  };

  return (
    <PayrollContext.Provider
      value={{
        activeWorkerKey,
        activePersona,
        record,
        offer,
        loading,
        error,
        setPersona,
        refresh,
        resetStore,
        acceptOffer,
        confirmPayment,
        proveContribution,
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
};

export const usePayroll = () => {
  const context = useContext(PayrollContext);
  if (!context) {
    throw new Error('usePayroll must be used within a PayrollProvider');
  }
  return context;
};
