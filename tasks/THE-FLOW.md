# The whole flow, start to finish

*One story, for the whole team: every step from "Karim gets hired" to "an auditor
checks the record", naming which app does it, which API method it calls, which
circuit runs under the hood, whose secret is used, and what travels where.
No blockchain knowledge assumed.*

**The cast:**

| | Runs where | Holds |
|---|---|---|
| **App C** — worker app | Karim's browser | Karim's secret, his salt, his copy of the rate |
| **App D** — employer app | The employer's browser | The employer's secret, the rates and salts they generated |
| **App E** — auditor | Anyone's browser | **Nothing. No wallet, no secret, no login** |
| **The api** (`@nightshift/api`) | Inside apps C and D | The only code that talks to the contract |
| **The backend** (D's NestJS) | A server | Real names, draft timesheets — and **never a secret, salt or salary** |
| **The chain** | Everywhere | Only sealed values and yes/no facts |

One rule explains every step below: **each circuit runs in the browser of whoever
calls it, using that person's own secret.** Secrets never travel; proofs do.

---

## Step 0 — Everyone gets a secret, automatically

The first time anyone opens app C or app D, the api silently generates
**32 random bytes** — their secret — and stores it in that browser's local
storage. Nobody types anything, nobody is emailed anything.

Their public **key** is just the hash of that secret. The secret never leaves
the device; the key is safe to show anyone.

> Padlock analogy: the key is the serial number engraved on the outside — anyone
> may read it. The secret is the physical key that opens it.

---

## Step 1 — The interview (no computers involved)

The employer meets Karim. Face, documents, right to work. **This is the actual
identity check in the whole system, and it is a human one.** From here on, the
system only ever guarantees "the same person" — it never re-checks *which*
person. ([Why that is enough](../A_docs/05-keys-storage-and-identity.md).)

---

## Step 2 — Karim sends his key to the employer

App C has a screen showing Karim his own key:

```
Your worker key:   0x7f3a…      [ Copy ]  [ Show QR ]
```

He gets it to the employer however they agree — reads it out in the interview,
shows the QR on his screen, or pastes it into a message. The employer enters it
into app D's "New employee" form.

**The key is not a secret**, so showing it leaks nothing. But be honest about
the channel: if Karim texts it and someone intercepts and swaps in *their own*
key, the employer would hire the attacker believing it is Karim. That is
[open question 1](../A_docs/06-open-design-questions.md) — the in-person QR is
the safe version, and the demo should use it.

---

## Step 3 — The employer hires (app D)

The employer types the agreed salary — say 5,000 — into app D and clicks
**Seal and send offer**.

Under the hood:

```
App D  →  api.hire({ workerKey: 0x7f3a…, ratePerPeriod: 5000n, expectedHours: 1 })
             │
             ├─ the api generates a random SALT
             ├─ computes  commitment = seal(5000, salt)     ← the sealed envelope
             │
             └─ calls the `hire` CIRCUIT, in the employer's browser
                    ├─ localSk() returns THE EMPLOYER's secret
                    ├─ checks: hash(secret) == employerKey on the chain
                    │          (only the employer passes this)
                    └─ writes to the chain:  0x7f3a… → commitment
```

**What reached the chain:** Karim's key and 32 bytes of unreadable seal.
**What did not:** the 5,000, the salt, the employer's secret.

The api hands app D back the rate and salt to pass to Karim — because he will
need both in step 4.

---

## Step 4 — The offer handoff (the sensitive moment)

The employer must get **the rate (5,000) and the salt** to Karim. App D shows
them once, ideally as a QR code Karim scans from app C, in the room.

> ⚠️ **This is the most sensitive transmission in the entire product.** Whoever
> reads this message learns the salary — no cryptography involved, it is the
> number in plaintext. Never email it casually. This is
> [open question 2](../A_docs/06-open-design-questions.md), our most important
> honest caveat.

---

## Step 5 — Karim accepts (app C)

App C asks Karim to enter (or scan) the rate and salt he was given, and taps
**Accept offer**.

```
App C  →  api.acceptOffer({ ratePerPeriod: 5000n, salt })
             │
             └─ calls the `acceptHire` CIRCUIT, in KARIM's browser
                    ├─ localSk() returns KARIM's secret  (his browser, his secret)
                    ├─ recomputes  seal(5000, salt)
                    ├─ compares to the commitment the employer put on the chain
                    │     match     → accepted, Karim marked active
                    │     mismatch  → TRANSACTION FAILS
                    └─ the api stores rate + salt in Karim's local storage
```

**Why this step exists:** the sealed value is unreadable — including by Karim.
Without this check, the employer could promise 5,000 and quietly seal 4,000, and
he would only find out on payday. Here, **a lying employer is caught on day
zero**, before any work happens.

---

## Step 6 — Approve hours (app D)

Each period, the employer approves the timesheet — 47 hours for Dana, always 1
for salaried Karim.

```
App D  →  api.approveHours({ workerKey, period: '2026-04', hours: 1 })
             └─ `approveHours` CIRCUIT, employer's browser, employer's secret
                    └─ writes hours to the chain, publicly
```

Hours are public **on purpose**: the employer already knows them, and 1 hour at
an unknown rate is an unknown number. Only the rate is guarded.

*(Draft timesheets before approval live in D's backend, not on the chain —
editing a draft six times should not cost six transactions.)*

---

## Step 7 — Payday (app D → Karim's wallet, no contract involved)

```
App D  →  api.payWorker({ workerKey, recipientShieldedAddress, amount: 5000n })
             └─ a PRIVATE wallet-to-wallet transfer of shielded NIGHT
                (B's SPIKE-PAY, proven on a real devnet)
                — the contract never touches the money
```

**Two identifiers, and they are not the same thing.** `workerKey` says *who Karim
is inside the contract*. `recipientShieldedAddress` says *where his money goes* —
it comes from his own wallet, and nothing on-chain connects the two. That is
deliberate: if the ledger paired an employment record with a payment address,
anyone could match the two. So Karim gives the employer his shielded address at
hiring, alongside his key, and the employer keeps it with their own records.

**The money is NIGHT, never DUST.** NIGHT is the transferable token; DUST is a
non-transferable resource that exists only to pay fees, and cannot be sent
between users at all. Any UI showing a salary in "DUST" is simply wrong.

The chain does not record this as "salary paid". It is just shielded money
moving. Whether it was *correct* is the next step — and that is Karim's to do,
not the employer's.

*Why not pay through the contract?* Not a style choice. Compact's `sendShielded`
does not currently create coin ciphertexts, so a contract paying anyone other
than its own caller leaves the recipient with no notification that the money
exists. Wallet-to-wallet is the documented way to do this today.

---

## Step 8 — Karim confirms — THE PRODUCT (app C)

Money arrived. App C shows *"April — payment received. Confirm it?"* Karim types
what actually arrived and taps **Confirm**.

```
App C  →  api.confirmPayment({ period: '2026-04', amountReceived: 5000n })
             │   (the api pulls rate + salt from Karim's local storage —
             │    no UI code ever touches them)
             │
             └─ `confirmPayment` CIRCUIT, KARIM's browser, KARIM's secret
                    ├─ the rate must open the sealed envelope from step 3
                    ├─ hours are READ FROM THE CHAIN (step 6) — Karim cannot
                    │  supply them, so he cannot inflate them
                    ├─ checks:  amountReceived == hours × rate
                    │
                    │     ✅ correct  → chain records:  April → paid ✓
                    │     ❌ wrong    → NO PROOF CAN BE PRODUCED.
                    │                  Nothing is recorded. April stays blank,
                    │                  publicly, forever.
                    └─ the amount itself reaches the chain in NEITHER case
```

If the employer sent 4,000: Karim types 4,000 (the truth), the arithmetic fails
against the sealed 5,000, and **he cannot confirm — even if he wanted to.** The
missing ✓ is permanent public evidence, while the salary stays unreadable.

> The system cannot record a wrong payment as correct. Not "should not."
> **Cannot.**

---

## Step 9 — Anyone checks (app E)

A regulator, a journalist, Karim's lawyer — anyone — opens app E. No login, no
wallet, no permission.

```
App E  →  reads the public chain (via the indexer — no circuits, no secrets)

              Jan   Feb   Mar   Apr
   0x7f3a…     ✓     ✓     ✓     ✓        Salary: 🔒 sealed — not readable
   0xc4e8…     ✓     ✓     ✗     ✓        Salary: 🔒 sealed — not readable
```

Karim — `0x7f3a…`, the person we have followed for nine steps — is confirmed
every month. The row underneath is someone else, and **the ✗ is the story**: that
worker could not confirm March, because the money that arrived did not match the
sealed agreement. Nobody adjudicated it and nobody could suppress it; the ✗ is
simply the absence of a proof that was never possible to make.

And there is nowhere on the chain an amount *could* appear — the ledger's data
shape has no field for one.

*(These two rows are the seeded demo data, `DEMO_KARIM` and `DEMO_SAM` in
`MockPayrollApi`, so E's board looks like this before anything real is deployed.)*

*(Matching `0x7f3a…` to the name "Karim" is only possible through D's backend
directory — which is exactly why every directory route is behind authentication.)*

---

## The one-glance summary

| Step | App | API call | Circuit | Whose secret | What goes public |
|---|---|---|---|---|---|
| 0 | C & D | (automatic) | — | — | nothing |
| 1 | — | interview | — | — | nothing |
| 2 | C → D | (copy / QR) | — | — | Karim's key (harmless) |
| 3 | **D** | `hire` | `hire` | employer's | key → sealed envelope |
| 4 | D → C | (QR handoff) | — | — | **nothing — but see the ⚠️** |
| 5 | **C** | `acceptOffer` | `acceptHire` | Karim's | "0x7f3a… is active" |
| 6 | **D** | `approveHours` | `approveHours` | employer's | the hours (write-once — cannot be revised later) |
| 7 | **D** | `payWorker` | — (wallet only) | — | nothing (shielded) |
| 8 | **C** | `confirmPayment` | `confirmPayment` | Karim's | one ✓ (or a permanent blank) |
| 9 | **E** | (reads only) | — | **none** | it only reads |

Three patterns worth noticing:

- **D and C alternate.** The employer acts (3, 6, 7), Karim responds (5, 8).
  Neither ever uses the other's secret, because each circuit runs in its
  caller's own browser.
- **Secrets appear in the "whose secret" column and nowhere in the "public"
  column.** Ever.
- **The two steps with no circuit at all** — 4 and 7 — are the handoff and the
  payment. One is our biggest honest caveat; the other is deliberately just
  private money moving, checked later by step 8.

---

*Deeper detail: [A_docs/07 — the circuit map](../A_docs/07-circuit-map.md) ·
what a key proves: [A_docs/05](../A_docs/05-keys-storage-and-identity.md) ·
the known gaps: [A_docs/06](../A_docs/06-open-design-questions.md)*
