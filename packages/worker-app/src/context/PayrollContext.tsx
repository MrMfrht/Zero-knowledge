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

/**
 * The outcome of a write, in the form the UI needs to render it.
 *
 * Three outcomes look identical to a `try/catch` and must not look identical
 * to a person: the contract refusing an untrue claim (`isMismatch` — the
 * product working), this browser having no wallet to sign with
 * (`needsWallet` — nothing was ever sent), and everything else.
 */
export interface WriteResult {
  success: boolean;
  /** Always present when `success` is false. Written to be shown as-is. */
  error?: string;
  isMismatch?: boolean;
  needsWallet?: boolean;
}

const NO_WALLET_MESSAGE =
  'Connect a Midnight wallet to do this. Nothing was sent — this action has to be ' +
  'signed and proved on your own device, so no wallet means no transaction.';

/**
 * Two different throws mean "there is no wallet to sign with".
 *
 * `NoWalletFoundError` comes from the connector when no extension is injected
 * on `window.midnight`; the plain `Error('No wallet connected...')` comes from
 * `MidnightPayrollApi`'s own guard when a wallet exists but this session never
 * connected. Matched by name and message rather than `instanceof` because
 * neither class is re-exported from `@nightshift/api`'s entry point, and
 * reaching into another package's internals is forbidden (CLAUDE.md).
 */
function isWalletUnavailable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === 'NoWalletFoundError' || /no wallet (found|connected)/i.test(err.message);
}

/** Turns anything thrown by a write into a sentence, never into silence. */
function describeWriteFailure(err: unknown, fallback: string): WriteResult {
  if (isWalletUnavailable(err)) {
    return { success: false, needsWallet: true, error: NO_WALLET_MESSAGE };
  }
  const detail = err instanceof Error && err.message.trim() ? err.message : fallback;
  return { success: false, error: detail };
}

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
  /** Whether this browser has a wallet connected and able to sign. */
  walletConnected: boolean;
  walletBusy: boolean;
  /** Why the last connect attempt failed, ready to render. Null when fine. */
  walletError: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  acceptOffer: (ratePerPeriod: bigint, salt: string) => Promise<WriteResult>;
  confirmPayment: (period: Period, amountReceived: bigint) => Promise<WriteResult>;
  proveContribution: (period: Period, declared: bigint) => Promise<WriteResult>;
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

  // The worker signs their own transactions -- confirmPayment and
  // proveContribution are proved on this device against this person's own
  // secret, which is the entire point of the product. So the worker app needs
  // its own wallet connection; it cannot borrow the employer's.
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

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

  const acceptOffer = async (ratePerPeriod: bigint, salt: string): Promise<WriteResult> => {
    try {
      await api.acceptOffer({ ratePerPeriod, salt });
      await refresh();
      return { success: true };
    } catch (err) {
      // Logged as well as returned: the returned sentence is for the person,
      // the console line is what a developer needs when they ask why.
      console.error('acceptOffer failed:', err);
      if (err instanceof OfferMismatchError) {
        return {
          success: false,
          isMismatch: true,
          error: 'The sealed amount does not match what you entered. Do not accept — contact your employer.',
        };
      }
      return describeWriteFailure(err, 'Failed to accept offer.');
    }
  };

  const confirmPayment = async (period: Period, amountReceived: bigint): Promise<WriteResult> => {
    try {
      await api.confirmPayment({ period, amountReceived });
      await refresh();
      return { success: true };
    } catch (err) {
      console.error('confirmPayment failed:', err);
      if (err instanceof PaymentMismatchError) {
        await refresh();
        return {
          success: false,
          isMismatch: true,
          error: 'Cannot confirm. The amount you received does not match your agreed salary. This period stays unconfirmed on the public record.',
        };
      }
      return describeWriteFailure(err, 'Confirmation failed.');
    }
  };

  const proveContribution = async (period: Period, declared: bigint): Promise<WriteResult> => {
    try {
      await api.proveContribution({ period, declared });
      await refresh();
      return { success: true };
    } catch (err) {
      console.error('proveContribution failed:', err);
      if (err instanceof ContributionMismatchError) {
        return {
          success: false,
          isMismatch: true,
          error: 'The declared contribution was not calculated on your real salary.',
        };
      }
      return describeWriteFailure(err, 'Contribution verification failed.');
    }
  };

  const connectWallet = async () => {
    setWalletBusy(true);
    setWalletError(null);
    try {
      const status = await api.connectWallet();
      setWalletConnected(status.connected);
      // A freshly connected wallet can change nothing about who this browser
      // IS -- identity comes from localSk, not the wallet -- but it does
      // change what is possible, so re-read rather than leave a stale screen.
      await refresh();
    } catch (err) {
      console.error('connectWallet failed:', err);
      setWalletConnected(false);
      setWalletError(
        isWalletUnavailable(err)
          ? 'No Midnight wallet found. Install the Lace Midnight Preview extension, set its network to Undeployed, and reload this page.'
          : err instanceof Error && err.message.trim()
            ? err.message
            : 'Could not connect to the wallet.',
      );
    } finally {
      setWalletBusy(false);
    }
  };

  const disconnectWallet = async () => {
    setWalletBusy(true);
    try {
      await api.disconnectWallet();
      setWalletConnected(false);
      setWalletError(null);
    } catch (err) {
      console.error('disconnectWallet failed:', err);
    } finally {
      setWalletBusy(false);
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
        walletConnected,
        walletBusy,
        walletError,
        connectWallet,
        disconnectWallet,
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
