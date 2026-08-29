# Task D — The employer app

**You are building:** the app a company uses. They hire someone, approve their hours, and pay them privately.

**Your folder:** `packages/employer-app/`
**Your branch:** `feat/employer-app`

---

## Do you need WSL?

# No

You are building a normal React website. Windows, Mac, Linux — all fine.

You never compile a smart contract. All you need is **Node.js 22+** from [COMMON.md](COMMON.md).

One optional extra: if you want to send real test payments on your own machine later, install **Docker Desktop**. It runs on Windows normally — you use it from PowerShell and never touch Linux. Not needed to start.

---

## Why this task exists

This app has to make one strange idea feel completely ordinary:

> **The employer seals the salary onto a public blockchain — and then cannot read it back, cannot change it, and cannot pretend it was a different number.**

That is unusual. A normal payroll system lets an HR admin edit a salary whenever they like. Ours does not, on purpose, and your app is where that becomes visible.

You are also building the half of the demo that **creates the failure.** In the demo, an employer underpays someone. Your app must let that happen naturally — because the point is that the *worker's* app then refuses to confirm it.

---

## Screens to build

### 1. Hire someone

```
New employee

Worker's ID:      [ 0x7f3a…              ]
Monthly salary:   [ 5000                 ]

⚠️ Once sealed, this cannot be changed.
   The worker must confirm this exact number.

[ Seal and send offer ]
```

Make the warning real. It is not a scary-sounding legal notice — it is literally true, enforced by the blockchain.

### 2. Team list

Everyone hired, and their payment status per month.

```
Karim     Jan ✅  Feb ✅  Mar ✅  Apr ⏳
Dana      Jan ✅  Feb ✅  Mar ✗   Apr ⏳
```

Note that **you cannot show anyone's salary here** — you genuinely do not have it. That surprises people. Consider putting a small note on the screen saying so.

### 3. Approve hours (for hourly workers)

```
Dana — March 2026
Hours worked:  [ 47 ]

[ Approve timesheet ]
```

Hours are **public on purpose** — the client already knows them, and only the *rate* is sensitive. That is what selective disclosure means in practice: hide exactly what needs hiding, and no more.

For salaried employees, hours is always 1. Handle both.

### 4. Pay

```
Karim — April 2026
Amount:  [ 5000 ]

[ Send private payment ]
```

The money goes **wallet to wallet, privately**. It does not go through the smart contract at all.

Leave this amount field editable. In the demo, someone types 4,000 here and the worker's app then refuses to confirm it. That is the whole show.

---

## How to start today, with nothing from anyone else

```bash
npm create vite@latest employer-app -- --template react-ts
```

Build all four screens with **fake hardcoded data**. Do not wait for the contract or the API.

Then do the one piece of real integration you can do alone: **get a wallet connecting.** Follow the [React wallet connector guide](https://docs.midnight.network/guides/react-wallet-connect) and MIDSKILLS' `react-wallet-connector` skill. Connecting a wallet does not depend on our contract at all, so you can finish it early — and both apps need it, so share what you learn with C.

When the lead pushes `packages/api/`, swap fake data for:

```typescript
import { PayrollApi } from '@nightshift/api';

await payrollApi.hire(workerKey, sealedRate);
await payrollApi.approveHours(workerKey, period, hours);
```

It is a fake implementation at first. When B finishes the real one, **your code does not change.**

---

## Later: let the employer pay everyone's fees

Every blockchain action costs a small fee, paid in something called DUST. A brand-new worker has none, and getting some takes about 12 hours through the normal route.

So a new employee could not confirm their first payment. That is a terrible first experience.

The fix is called **sponsorship**: the employer pays the fee on the worker's behalf. The worker still signs and proves everything themselves — the employer only covers the cost, and gains no extra power.

Read [Sponsor transaction fees with DUST](https://docs.midnight.network/guides/dust-sponsorship) and the [reference implementation](https://github.com/midnightntwrk/example-private-party/blob/main/docs/SPONSORSHIP.md).

**Do this after the basic flow works.** It is a strong feature and a bad first task.

---

## How your work connects to everything else

```
   YOU: employer hires  ──►  sealed salary on the blockchain
                                        │
                                        ▼
                              C's worker app: accept
                                        │
   YOU: employer pays  ─────────────────┤
   (wallet → wallet, private)           │
                                        ▼
                              C's worker app: confirm
                                        │
                                        ▼
                              E's auditor view: ✅ or ✗
```

You start every flow. **C finishes it.** Work closely with them — a hire that C's app cannot accept is a bug in one of your two apps, and you will find it fastest by testing together.

Share your wallet-connection code with C. Do not both solve it separately.

---

## Done when

- [ ] Hire → approve hours → pay, all in one sitting, without confusion
- [ ] The "cannot be changed" warning is on the hire screen and is honest
- [ ] The team list makes clear the employer **cannot see salaries**
- [ ] A wallet connects
- [ ] The pay amount is editable, so the demo's underpayment can be performed live

---

## Rules you must not break

1. **Never `import` anything starting with `@midnight-ntwrk/`.** Only `packages/api/` does that. Need something? Ask B and the lead.
2. **The employer app must never learn a worker's salt or secret key.** If your app can compute a worker's proof, we have built the wrong thing.
3. **Do not add an "edit salary" button.** People will ask for it. The answer is no — that is the product.

---

## Stuck?

- Wallet connection → [React wallet connector guide](https://docs.midnight.network/guides/react-wallet-connect)
- Fee sponsorship → [DUST sponsorship guide](https://docs.midnight.network/guides/dust-sponsorship)
- Anything about Midnight → **Ask AI** on [docs.midnight.network](https://docs.midnight.network/)
