# Task C — The worker app

**You are building:** the app an employee or contractor uses. They accept a job offer, and each payday they confirm they were paid correctly.

**Your folder:** `packages/worker-app/`
**Your branch:** `worker-app` (branched from `dev`)

---

## Do you need WSL?

# No

You are building a normal React website. Windows, Mac, Linux — all fine, nothing special.

You never compile a smart contract. You never install the Compact compiler. You call functions that someone else wrote.

All you need is **Node.js 22+**, which you installed in [COMMON.md](COMMON.md).

---

## Why this task exists

This is where the promise of the whole project either feels real or feels fake.

A worker opens your app and needs to understand two things instantly:

1. **My salary is private.** Not "encrypted on a server somewhere" — genuinely unreadable by anyone, including my employer's bank, including this app's developers.
2. **I can prove I was paid correctly**, without telling anyone what I earn.

If your app makes that feel obvious, the project works. If it looks like a normal payroll website, the judges will not understand what we built.

---

## Screens to build

### 1. Accept a job offer

The employer has put a sealed salary on the blockchain. The worker types in the salary they were *told*, and the app checks it matches.

```
Cedar Café has offered you a position.

Enter the monthly salary you agreed:   [  5000  ]

[ Accept offer ]
```

**If the numbers do not match, this fails** — and that is a feature worth showing. It means an employer cannot secretly seal a different number than the one they promised. Show a clear error: *"The sealed amount does not match what you entered. Do not accept — contact your employer."*

### 2. My payments

A list of months with a status each.

```
March 2026    ✅ Confirmed paid
April 2026    ⚠️ Payment received — confirm it?
May 2026      ✗ Not confirmed
```

### 3. Confirm a payment

The worker enters what actually arrived. The app proves it matches the sealed agreement.

```
April 2026
Amount you received:   [  5000  ]

[ Confirm payment ]
```

**The most important thing in the entire app happens here.** If they enter a wrong amount, it fails — because the maths does not match the sealed agreement. Show that clearly:

> ❌ **Cannot confirm.** The amount you received does not match your agreed salary. This month stays unconfirmed on the public record.

That is not an error message. That is the product working exactly as designed. Make it look deliberate, not broken.

### 4. The privacy panel

A small always-visible panel showing the two columns side by side:

```
┌─ On the blockchain ─────┐   ┌─ Never leaves your device ─┐
│ ✅ March: confirmed      │   │ Your salary:  5000          │
│ ✅ April: confirmed      │   │ Your secret key             │
│ Employed since Jan 2026 │   │ Your salt                   │
└─────────────────────────┘   └─────────────────────────────┘
```

Judges will look at this for five seconds and understand the whole project. Make it good.

---

> **Your API guide: [packages/api/README.md](../packages/api/README.md)** — the "For C" section has paste-ready code for every screen below.

## How to start today, with nothing from anyone else

```bash
npm create vite@latest worker-app -- --template react-ts
```

Build all four screens with **fake hardcoded data**. Do not wait for the contract or the API. Layout, navigation, and how the screens feel do not depend on any of it.

Then swap your fake data for the real API, which already exists:

```ts
import { MockPayrollApi, DEMO_KARIM, PaymentMismatchError } from '@nightshift/api';

const api = new MockPayrollApi({ actingAs: DEMO_KARIM });

try {
  await api.confirmPayment({ period: '2026-04', amountReceived: 5000n });
} catch (e) {
  if (e instanceof PaymentMismatchError) {
    // the demo moment — show it deliberately, not as a crash
  }
}
```

Notice you do **not** pass the rate or the salt. The api reads them from the device. No UI code ever holds a secret.

`MockPayrollApi` is a working fake with seeded data. Later B swaps in the real one and **only the line that creates `api` changes.** Every worked example is in **[packages/api/README.md](../packages/api/README.md)**.

---

## The one hard part: the salt

When a worker accepts a job, their device generates a random secret value called a **salt**. It is what makes the sealed salary unreadable to everyone else.

**If they lose the salt, they can never confirm a payment again.**

So you must save it somewhere that survives closing the browser. Read how the [ZK Loan example](https://docs.midnight.network/examples/dapps/zkloan) does it — it uses an encrypted local store with a password of at least 16 characters.

Two things to decide with the lead:

- Where the salt is stored
- What the app tells the user if it is gone

Do not leave this until the end. It is the difference between a demo and a product.

---

## How your work connects to everything else

```
   A writes the contract  ──►  B wraps it in packages/api/
                                        │
                                        ▼
                              YOU import PayrollApi
                              (fake now, real later —
                               your code is identical)
                                        │
                                        ▼
                              A worker confirms a payment
                                        │
                                        ▼
                              E's auditor view shows ✅
```

You and **D (employer app)** are the two halves of the demo. D hires and pays; you accept and confirm. Talk to each other so the two apps feel like one product, not two projects.

You and **E** should share styling. Your privacy panel and their auditor board are showing the same truth from two directions.

---

## New, 2026-08-30: show the worker their shielded address

There is a second identifier the worker needs to hand over, and right now no
screen shows it.

```ts
const address = await api.getMyShieldedAddress();  // "mn_shield-addr_..."
```

**It is not the same as their worker key, and one cannot be derived from the
other.** The key says *who they are inside the contract*; this says *where money
goes*. Nothing on-chain connects them — deliberately, because pairing an
employment record with a payment address on a public ledger would undo the
pseudonymity entirely.

Practically: the employer cannot pay anyone until they have this. So wherever
you already show the worker key for copying, show the shielded address the same
way — copy button, QR, whatever you built — and label the difference plainly, so
nobody sends money to a worker key and wonders where it went.

Needs a connected wallet, since it comes from the wallet itself.

---

## Done when

- [ ] Someone who has never seen the project can accept an offer and confirm a payment without being told how
- [ ] Entering a **wrong amount** fails, with a message that looks intentional
- [ ] The salt survives a page refresh
- [ ] The privacy panel is accurate — no lies in either column
- [ ] The worker can copy **both** their worker key and their shielded address, and the difference is obvious
- [ ] It works against the fake API, so switching to the real one is a one-line change

---

## Rules you must not break

1. **Never `import` anything starting with `@midnight-ntwrk/`.** Only `packages/api/` does that. If you feel you need it, the interface is missing a method — ask, do not work around it.
2. **Never send the salt or the secret key to a server.** They stay in the browser. This is the entire product; there is no version of this rule that bends.
3. **Do not put a salary in a URL, a log, or an analytics event.**

---

## Stuck?

- Wallet connection → [React wallet connector guide](https://docs.midnight.network/guides/react-wallet-connect)
- What a word means → the glossary in [COMMON.md](COMMON.md), or **Ask AI** on [docs.midnight.network](https://docs.midnight.network/)
- The API does not do what you need → **ask B and the lead.** Do not bypass it.
