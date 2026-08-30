import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  createPayrollApi,
  payrollApiConfigFromEnv,
  DEMO_KARIM,
  DEMO_DANA,
  DEMO_SAM,
  resetMockStore,
  OfferMismatchError,
  PaymentMismatchError,
  ContributionMismatchError,
} from '@nightshift/api';
import type { PayrollApi } from '@nightshift/api';
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
  /** True when this app is talking to a deployed contract, not the mock. */
  live: boolean;
  /** One line naming the backend, for the UI to show. */
  backendLabel: string;
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
  // Real contract if VITE_CONTRACT_ADDRESS is set, mock otherwise. Read once:
  // switching backends mid-session would leave half the screen stale.
  const config = useMemo(() => payrollApiConfigFromEnv(import.meta.env), []);
  const [{ live, label: backendLabel }] = useState(() =>
    createPayrollApi({ ...config, actingAs: DEMO_KARIM }),
  );

  /**
   * Two different things, and conflating them is what breaks the live mode.
   *
   * `personaKey` is which demo character the mock should impersonate — a
   * selector in the UI. `activeWorkerKey` is who this session actually IS.
   * Against the mock they are the same. Against a real contract there is no
   * such thing as impersonation: identity is `dappKey(localSk(),
   * deploymentId)`, derived from a secret this browser holds, and the api is
   * the only thing that can answer it. So live mode ignores the selector and
   * asks `getMyKey()`.
   */
  const [personaKey, setPersonaKey] = useState<WorkerKey>(DEMO_KARIM);
  const [activeWorkerKey, setActiveWorkerKey] = useState<WorkerKey>(DEMO_KARIM);
  const [api, setApi] = useState<PayrollApi>(() => createPayrollApi({ ...config, actingAs: DEMO_KARIM }).api);
  const [record, setRecord] = useState<EmploymentRecord | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activePersona: PersonaOption = live
    ? {
        key: activeWorkerKey,
        name: 'This device',
        role: 'Identity derived from this browser’s own secret',
        description: 'On chain there are no personas — nothing can act as someone else.',
      }
    : PERSONAS.find((p) => p.key === personaKey) || {
        key: personaKey,
        name: 'Custom Worker',
        role: 'Worker',
        description: 'Active session',
      };

  const loadData = useCallback(
    async (currentApi: PayrollApi, selectedPersona: WorkerKey) => {
      setLoading(true);
      setError(null);
      try {
        const workerKey = live ? await currentApi.getMyKey() : selectedPersona;
        setActiveWorkerKey(workerKey);

        // A brand-new device is nobody's employee yet, and the contract says
        // so by throwing. That is not an error to shout about: the offer below
        // is exactly what such a worker is here to look at.
        try {
          setRecord(await currentApi.getEmploymentRecord(workerKey));
        } catch (recordError) {
          if (!live) throw recordError;
          setRecord(null);
        }

        setOffer(await currentApi.getMyOffer());
      } catch (err) {
        console.error('Failed to load payroll record:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch employment record');
      } finally {
        setLoading(false);
      }
    },
    [live],
  );

  useEffect(() => {
    // Live mode builds one api and keeps it: `actingAs` means nothing there,
    // so rebuilding per persona would only throw away the wallet connection.
    const newApi = live ? api : createPayrollApi({ ...config, actingAs: personaKey }).api;
    if (newApi !== api) setApi(newApi);
    void loadData(newApi, personaKey);
    // `api` is deliberately not a dependency: it is set by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaKey, loadData, live, config]);

  const setPersona = (key: WorkerKey) => {
    setPersonaKey(key);
  };

  const refresh = async () => {
    await loadData(api, personaKey);
  };

  const resetStore = async () => {
    // There is no reset on a real chain. `resetMockStore` would silently do
    // nothing there, and a button that appears to work and does not is worse
    // than one that is absent — the Header hides it in live mode.
    if (!live) resetMockStore();
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
        live,
        backendLabel,
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
