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
}

export type PureCircuits = {
}

export type Circuits<PS> = {
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
}

export type Ledger = {
  readonly employerKey: Uint8Array;
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
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
