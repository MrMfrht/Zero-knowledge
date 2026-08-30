import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  localSk(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  hire(context: __compactRuntime.CircuitContext<PS>,
       worker_0: Uint8Array,
       rateCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptHire(context: __compactRuntime.CircuitContext<PS>,
             rate_0: bigint,
             salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  approveHours(context: __compactRuntime.CircuitContext<PS>,
               worker_0: Uint8Array,
               period_0: bigint,
               hours_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  confirmPayment(context: __compactRuntime.CircuitContext<PS>,
                 period_0: bigint,
                 rate_0: bigint,
                 salt_0: Uint8Array,
                 amountReceived_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  proveContribution(context: __compactRuntime.CircuitContext<PS>,
                    period_0: bigint,
                    rate_0: bigint,
                    salt_0: Uint8Array,
                    declared_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  endEmployment(context: __compactRuntime.CircuitContext<PS>,
                worker_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  hire(context: __compactRuntime.CircuitContext<PS>,
       worker_0: Uint8Array,
       rateCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptHire(context: __compactRuntime.CircuitContext<PS>,
             rate_0: bigint,
             salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  approveHours(context: __compactRuntime.CircuitContext<PS>,
               worker_0: Uint8Array,
               period_0: bigint,
               hours_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  confirmPayment(context: __compactRuntime.CircuitContext<PS>,
                 period_0: bigint,
                 rate_0: bigint,
                 salt_0: Uint8Array,
                 amountReceived_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  proveContribution(context: __compactRuntime.CircuitContext<PS>,
                    period_0: bigint,
                    rate_0: bigint,
                    salt_0: Uint8Array,
                    declared_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  endEmployment(context: __compactRuntime.CircuitContext<PS>,
                worker_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  dappKey(sk_0: Uint8Array, deployment_0: Uint8Array): Uint8Array;
  sealRate(rate_0: bigint, salt_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  dappKey(context: __compactRuntime.CircuitContext<PS>,
          sk_0: Uint8Array,
          deployment_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  sealRate(context: __compactRuntime.CircuitContext<PS>,
           rate_0: bigint,
           salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  hire(context: __compactRuntime.CircuitContext<PS>,
       worker_0: Uint8Array,
       rateCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptHire(context: __compactRuntime.CircuitContext<PS>,
             rate_0: bigint,
             salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  approveHours(context: __compactRuntime.CircuitContext<PS>,
               worker_0: Uint8Array,
               period_0: bigint,
               hours_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  confirmPayment(context: __compactRuntime.CircuitContext<PS>,
                 period_0: bigint,
                 rate_0: bigint,
                 salt_0: Uint8Array,
                 amountReceived_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  proveContribution(context: __compactRuntime.CircuitContext<PS>,
                    period_0: bigint,
                    rate_0: bigint,
                    salt_0: Uint8Array,
                    declared_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  endEmployment(context: __compactRuntime.CircuitContext<PS>,
                worker_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly employerKey: Uint8Array;
  readonly deploymentId: Uint8Array;
  agreedRate: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  approvedHours: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  readonly contributionRate: bigint;
  contributionOk: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  paidFor: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  active: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               contributionPct_0: bigint,
               deployment_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
