/**
 * Errors the apps are expected to catch and show to a person.
 *
 * Two of these are not failures. `OfferMismatchError` and
 * `PaymentMismatchError` are the product working — the system refusing to
 * record something untrue. Design the UI for them deliberately, not as a
 * generic "something went wrong".
 */

/** Base class, so `catch (e) { if (e instanceof PayrollError) ... }` works. */
export class PayrollError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The rate and salt do not open the sealed value on the blockchain.
 *
 * The employer sealed a different number than the one they told the worker.
 * This is the check that makes `acceptOffer` worth doing at all.
 *
 * Suggested wording:
 *   "The sealed amount does not match what you entered. Do not accept this
 *    offer — contact your employer."
 */
export class OfferMismatchError extends PayrollError {
  constructor() {
    super('The sealed rate does not match the rate and salt provided.');
  }
}

/**
 * The amount received does not equal hours × the sealed rate.
 *
 * THIS IS THE DEMO. The worker cannot confirm a wrong payment even if they
 * want to, because the proof would not verify. The period stays unconfirmed on
 * the public record.
 *
 * Suggested wording:
 *   "Cannot confirm. The amount you received does not match your agreed
 *    salary. This period stays unconfirmed on the public record."
 *
 * Do not style it as a crash. Style it as a deliberate refusal.
 */
export class PaymentMismatchError extends PayrollError {
  constructor() {
    super('The amount received does not match the sealed agreement.');
  }
}

/** The declared social-security contribution was not calculated on the real salary. */
export class ContributionMismatchError extends PayrollError {
  constructor() {
    super('The declared contribution does not match the sealed rate.');
  }
}

/**
 * This device does not hold the rate and salt for this worker.
 *
 * Usually means the offer was accepted in a different browser, or site data was
 * cleared. The money is safe, but this period cannot be confirmed from here.
 */
export class MissingPrivateStateError extends PayrollError {
  constructor() {
    super('No sealed agreement stored on this device. Accept an offer first.');
  }
}

/** The employer has not approved a timesheet for this period yet. */
export class HoursNotApprovedError extends PayrollError {
  constructor(period: string) {
    super(`Hours for ${period} have not been approved by the employer yet.`);
  }
}

/** This period was already confirmed. Confirming twice is not allowed. */
export class AlreadyConfirmedError extends PayrollError {
  constructor(period: string) {
    super(`${period} has already been confirmed.`);
  }
}

/** No such worker in this contract. */
export class UnknownWorkerError extends PayrollError {
  constructor(workerKey: string) {
    super(`No worker with key ${workerKey}.`);
  }
}
