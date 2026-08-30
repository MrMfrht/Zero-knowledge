# Implementation Plan — NestJS Backend (`services/backend`)

Build the backend service for NightShift: the off-chain half that holds what must **not** go on a public blockchain — the real-name directory, draft timesheets, notifications, and reporting.

**Status of this document:** reviewed and enhanced. The original plan was structurally sound and correctly quoted the privacy rules. Two things needed fixing before anyone starts: a build blocker that would fail on the first command, and a security hole in the directory design that would undo the entire product's privacy. Both are addressed below.

---

# Part 0 — Read this before writing any code

## 🔴 BLOCKER: `services/*` is not a workspace

Root `package.json` currently reads:

```json
"workspaces": ["packages/*"]
```

So `npm run build -w services/backend` **fails immediately** — npm does not know that workspace exists. This must be fixed first, in the root `package.json`:

```json
"workspaces": ["packages/*", "services/*"]
```

Then run `npm install` from the repo root once, so npm links the new workspace.

## 🔴 CRITICAL: the directory is a deanonymization service

This is the most important paragraph in this document.

Our blockchain is **public**. Anyone can read it and see:

```
0x7f3a…  Jan ✅  Feb ✅  Mar ✗  Apr ✅
```

Pseudonyms, and whether each month was confirmed. That is safe, because `0x7f3a…` means nothing to anyone.

The directory maps `0x7f3a…` → **"Karim Al-Mansoor"**.

**Join those two datasets and you get: "Karim Al-Mansoor was not paid in March 2026" — publicly, for anyone who asks.** An open `GET /directory` endpoint hands out the key that unlocks every pseudonym on a permanent public ledger. It would destroy the privacy property the entire project is built on, and it would do it through a REST route that looks completely innocuous.

The cryptography would be perfect and the product would be broken.

**Therefore, non-negotiable:**

1. **Every `/directory` route requires authentication.** No exceptions, not even in the demo.
2. **A worker may read only their own entry.** Only an employer may list everyone.
3. **The directory is the highest-value target in this system.** Treat it that way.
4. **Say this out loud in the demo.** "The one thing that could break our privacy is the name directory, so it is the one thing behind auth." That is a strength, not an admission.

For a hackathon, a shared bearer token from an environment variable is enough. What is *not* enough is nothing.

## ⚠️ Two decisions the lead must confirm

| Question | Why it matters |
|---|---|
| **Is NestJS confirmed?** | [CLAUDE.md](../CLAUDE.md) says NestJS **only if two or more people already know it**, otherwise Fastify with the same module layout. If nobody knows Nest, its boilerplate costs more than its structure buys. |
| **Who owns `services/backend`?** | The [rule book](../tasks/RULEBOOK.md) gives D `packages/employer-app/`. Nobody owns the backend. If D takes both, that is two packages for one person — say so deliberately rather than by accident. |

Do not start until both are answered.

---

# Part 1 — Where everything lives, and how we avoid merge conflicts

## The layout, with an owner for every folder

```
Zero-knowledge/
├── package.json              ⚠️ SHARED — lead only. See "the one shared file" below
├── tsconfig.base.json        ⚠️ SHARED — lead only
├── .gitignore                ⚠️ SHARED — lead only
│
├── packages/
│   ├── shared/               🔒 LEAD    types everyone imports. Ask before editing
│   ├── api/
│   │   ├── src/PayrollApi.ts 🔒 LEAD    the interface. Ask before editing
│   │   ├── src/mock/         🔒 LEAD    the fake
│   │   └── src/midnight/     👤 B       the real implementation
│   ├── contract/             👤 A       payroll.compact + generated managed/
│   ├── worker-app/           👤 C       React + Vite
│   ├── employer-app/         👤 D       React + Vite
│   └── auditor/              👤 E       React + Vite, read-only
│
└── services/
    └── backend/              👤 D       NestJS. THIS PLAN
```

**One folder, one owner. Never edit inside someone else's folder.** Git only conflicts when two people change the same file, so if everyone stays in their own tree there is nothing to resolve. Every conflict this team hits will come from the handful of shared files at the top, which is why they have a protocol.

## D owns two folders — keep them genuinely separate

D has `packages/employer-app/` (browser) and `services/backend/` (server). They are separate for a reason, not just tidiness:

| | `packages/employer-app/` | `services/backend/` |
|---|---|---|
| Runs in | The browser | Node, on a server |
| May hold a wallet | **Yes** — signs transactions | **Never** |
| May import `@midnight-ntwrk/*` | No (only `packages/api` does) | **Absolutely never** |
| May see a salt or secret key | Yes, in memory, in the browser | **Never** |
| Talks to | `@nightshift/api` + the backend over HTTP | The indexer over HTTPS |

**The two never merge into one package.** The whole product claim is that the server cannot read salaries. Sharing a process with wallet code would make that claim untrue, and it would be true-in-practice-but-unprovable, which is worse than useless.

### Sharing types between them — and the trap

The employer app needs the backend's response shapes. Do **not** copy-paste them; they will drift within a day.

Export them from the backend:

```ts
// services/backend/src/contracts/index.ts
//
// Types shared with the employer app. TYPES ONLY — never a class, never a
// service, never anything with a decorator on it.
export interface DirectoryEntry { /* … */ }
export interface Timesheet { /* … */ }
export type TimesheetStatus = /* … */;
```

Add the dependency in `packages/employer-app/package.json`:

```json
"dependencies": { "@nightshift/backend": "0.1.0" }
```

And import with **`import type`**, always:

```ts
import type { DirectoryEntry, Timesheet } from '@nightshift/backend/contracts';
```

> ### ⚠️ `import type` is not a style preference here
>
> A plain `import { DirectoryEntry } from '@nightshift/backend'` makes Vite follow
> the module graph into NestJS and try to bundle `@nestjs/core`, `reflect-metadata`,
> `rxjs` and Express **into the browser**. Best case, a build that takes forever
> and ships megabytes of server framework. Worst case, a stack of confusing errors
> about Node built-ins in the browser.
>
> `import type` is erased entirely at compile time — nothing at all reaches the
> bundle. Use it for every import from the backend, without exception.

## Ports — fixed now, before anyone collides

C has already taken 3000 on their branch. Everyone else takes one of these and nobody negotiates later:

| Port | Who | What |
|---|---|---|
| **3000** | C | worker-app (already chosen — do not take it) |
| **3001** | D | employer-app |
| **3002** | D | backend (this service) |
| **3003** | E | auditor |
| 6300 | — | Midnight proof server (fixed by Midnight, do not change) |
| 8088 | — | local indexer |
| 9944 | — | local node |

Put yours in `vite.config.ts` (frontends) or `.env` (backend). The backend's `CORS_ORIGINS` must list 3000, 3001 and 3003, or the browser silently blocks every request and you lose an hour to a problem with no error message in the terminal.

## The one shared file, and the protocol for it

`package.json` at the repo root is the only file more than one person genuinely needs to change — everyone wants to add a script, and D needs `services/*` in the workspaces list.

**It is currently untouched on every branch.** That is worth keeping.

> ### The rule: the lead makes ALL root changes in one commit, up front. Nobody else touches root `package.json`.

Ask the lead to land this **once**, before D starts:

```json
{
  "workspaces": ["packages/*", "services/*"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "dev:worker": "npm run dev -w @nightshift/worker-app",
    "dev:employer": "npm run dev -w @nightshift/employer-app",
    "dev:auditor": "npm run dev -w @nightshift/auditor",
    "start:backend": "npm run start:dev -w @nightshift/backend"
  }
}
```

Every script for every package, including ones that do not exist yet. A script pointing at a missing workspace simply fails when run — it does not break anything else — and it means **no one ever has to edit this file again.**

If you truly need a root change later: message the lead, they make it, everyone pulls. Do not edit it on your branch. Two people adding a line to the same JSON object is the single most likely conflict on this project, and it is entirely avoidable.

## Merge protocol

```
    dev  ←── the integration branch. Everything merges here.
     │
     ├── contract        A
     ├── api             B
     ├── worker-app      C
     ├── employer-app    D
     ├── backend         D   ← separate branch from employer-app
     └── auditor         E
```

Four habits, in order of how much pain they save:

1. **`git pull origin dev` at least twice a day.** Small merges are trivial; a three-day-old branch is an afternoon.
2. **Merge into `dev` as soon as something works.** Do not save it all for the end.
3. **Never merge into someone else's branch.** Go through `dev`.
4. **Two branches for D, not one.** `employer-app` and `backend` are different jobs on different schedules — the frontend will be merged and re-merged while the backend is still being built.

## If you do hit a conflict

Almost certainly root `package.json`. It is a JSON object, so:

```bash
git pull origin dev
# open package.json, keep BOTH sides' script lines, delete the <<<< ==== >>>> markers
npm install          # regenerate the lockfile
git add package.json package-lock.json && git commit
```

`package-lock.json` also conflicts and is not worth reading. Take either side and run `npm install` to regenerate it:

```bash
git checkout --theirs package-lock.json && npm install
```

Never hand-edit a lockfile.

# Part 2 — What this service is, and is not

## The one rule

> **The backend never sees a secret key, a salt, or a salary.**

It cannot compute a proof, cannot confirm a payment, and cannot read anyone's pay. If it could, we would be a normal payroll company with a blockchain logo, and every claim we make in the demo would be false.

Concretely: **no `@midnight-ntwrk/*` import may ever appear in this service.** It depends on `@nightshift/shared` and nothing else from our workspace.

## What it legitimately owns

Everything that must not be on a public ledger, or that a blockchain is simply bad at:

| Data | Why it is here and not on-chain |
|---|---|
| Real names, emails, departments | Putting these on a public chain would defeat the whole design |
| Draft timesheets | Dana edits hours six times before submitting. Six blockchain transactions is absurd |
| Notifications | Ephemeral, high-volume, worthless on-chain |
| Cached chain reads and reports | Aggregation is cheap here, expensive on-chain |

## The reads/writes rule

> **The backend reads the chain and never writes to it.**

Reading happens over the [Indexer GraphQL API](https://docs.midnight.network/api-reference/midnight-indexer) — an ordinary HTTPS endpoint. That is allowed and is **not** the Midnight SDK:

```
https://indexer.preview.midnight.network/api/v4/graphql
```

Every state-changing transaction is proven and signed **in the browser**, by C's and D's apps. The backend never submits one.

## Where the boundary sits — a worked example

Approving a timesheet touches both halves, and getting this wrong is the easiest mistake to make:

```
Dana edits hours in the UI               →  BACKEND   (draft, changes freely)
Dana submits for approval                →  BACKEND   (status: submitted)
Employer reviews and clicks Approve      →  BACKEND marks it submitted-for-chain
Employer's wallet signs approveHours()   →  BLOCKCHAIN  ← the real approval
Backend records the resulting tx hash    →  BACKEND   (bookkeeping only)
```

**`PATCH /timesheets/:id/approve` does not approve anything.** It records that the employer intends to, and stores the transaction hash once the browser has actually done it. The authoritative approval is `approveHours` on-chain, which only D's app can trigger, because only it has a wallet.

The original plan's naming implied the backend was the approver. It is not, and the endpoint is renamed below to stop anyone believing otherwise.

---

# Part 3 — File-by-file plan

## 2.1 Workspace wiring

### `[MODIFY]` `package.json` (repo root)

```json
{
  "workspaces": ["packages/*", "services/*"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "start:backend": "npm run start:dev -w @nightshift/backend"
  }
}
```

Then `npm install` at the root, once.

### `[NEW]` `services/backend/package.json`

```json
{
  "name": "@nightshift/backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start:dev": "nest start --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nightshift/shared": "0.1.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "typescript": "5.7.2",
    "vitest": "^2.1.0"
  }
}
```

> **Note:** NestJS needs `experimentalDecorators`, which conflicts with the repo's `verbatimModuleSyntax`. The backend tsconfig below deliberately overrides a few root settings — that is expected, and is why it does not simply extend the base unchanged.

### `[NEW]` `services/backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "strictPropertyInitialization": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

`strictPropertyInitialization: false` is required — NestJS injects dependencies after construction, so TypeScript cannot see that they are assigned.

### `[NEW]` `services/backend/.env.example`

```bash
PORT=3002
# Shared bearer token for employer-only routes. Generate a real one; do not ship this value.
EMPLOYER_API_TOKEN=change-me-before-the-demo
# Read-only chain access. No wallet, no keys.
INDEXER_URL=https://indexer.preview.midnight.network/api/v4/graphql
# Comma-separated origins allowed to call this API.
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3003
```

Add `.env` to `.gitignore` if it is not already covered.

## 2.2 Bootstrap

### `[NEW]` `services/backend/src/main.ts`

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Reject unknown fields rather than silently ignoring them, so a typo in a
  // request body fails loudly instead of writing a half-empty record.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);
  app.enableCors({ origin: origins.length > 0 ? origins : true, credentials: false });

  await app.listen(Number(process.env.PORT ?? 3002));
}

void bootstrap();
```

> **Do not use `app.enableCors()` with no arguments in anything but local dev.** It allows every origin.

### `[NEW]` `services/backend/src/app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { DirectoryModule } from './directory/directory.module.js';
import { TimesheetsModule } from './timesheets/timesheets.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ReportingModule } from './reporting/reporting.module.js';

@Module({
  imports: [DirectoryModule, TimesheetsModule, NotificationsModule, ReportingModule],
})
export class AppModule {}
```

## 2.3 Authentication — build this before the directory

### `[NEW]` `services/backend/src/auth/employer.guard.ts`

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Employer-only routes.
 *
 * A shared bearer token, which is the right level for a hackathon and is NOT
 * production authentication. Its job is to stop the directory being an open
 * deanonymization API — see Part 0 of this plan.
 */
@Injectable()
export class EmployerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.EMPLOYER_API_TOKEN;
    if (!expected || expected === 'change-me-before-the-demo') {
      // Fail closed. A missing token must never mean "allow everyone".
      throw new UnauthorizedException('Employer API token is not configured');
    }
    const header = context.switchToHttp().getRequest<Request>().headers.authorization;
    if (header !== `Bearer ${expected}`) {
      throw new UnauthorizedException('Employer credentials required');
    }
    return true;
  }
}
```

**Fail closed.** A misconfigured token must block access, never grant it. This is the single most important line of logic in the service.

## 2.4 Directory module

### `[NEW]` `services/backend/src/directory/dto/create-entry.dto.ts`

```ts
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class CreateDirectoryEntryDto {
  /** 32-byte hex worker key, exactly as it appears on-chain. */
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'workerKey must be 0x + 64 hex characters' })
  workerKey!: string;

  @IsString() @MaxLength(120) fullName!: string;
  @IsEmail() email!: string;
  @IsString() @MaxLength(60) department!: string;
  @IsString() @MaxLength(60) jobTitle!: string;
}
```

### `[NEW]` `services/backend/src/directory/directory.service.ts`

In-memory `Map`, seeded with the three demo workers whose keys are exported from `@nightshift/api` (`DEMO_KARIM`, `DEMO_DANA`, `DEMO_SAM`) so the backend and the mock agree.

```ts
export interface DirectoryEntry {
  workerKey: string;
  fullName: string;
  email: string;
  department: string;
  jobTitle: string;
}
```

**This interface must never gain a `salary` field.** If someone adds one, the product is over. Consider a test that asserts the shape.

### `[NEW]` `services/backend/src/directory/directory.controller.ts`

| Method | Route | Guard | Notes |
|---|---|---|---|
| `GET` | `/directory` | **EmployerGuard** | Full list. Employer only |
| `GET` | `/directory/:workerKey` | **EmployerGuard** | One entry |
| `POST` | `/directory` | **EmployerGuard** | Create, `409` if the key already exists |
| `DELETE` | `/directory/:workerKey` | **EmployerGuard** | Right-to-erasure. Chain history is unaffected |

```ts
@Controller('directory')
@UseGuards(EmployerGuard)   // ← applied to the whole controller, not route by route
export class DirectoryController { /* … */ }
```

Guard the controller, not individual routes. A route-level guard is one forgotten decorator away from an open endpoint.

`DELETE` is worth having: it is the only place a person can be forgotten, since the chain cannot be. That is a good answer to a GDPR question in Q&A.

## 2.5 Timesheets module

### `[NEW]` `services/backend/src/timesheets/timesheet.model.ts`

```ts
export type TimesheetStatus =
  | 'draft'              // worker is still editing
  | 'submitted'          // worker sent it to the employer
  | 'pending-onchain'    // employer accepted; the wallet has not signed yet
  | 'approved-onchain'   // approveHours confirmed. THIS is the real approval
  | 'rejected';

export interface Timesheet {
  id: string;
  workerKey: string;
  period: string;        // 'YYYY-MM', matches @nightshift/shared Period
  hours: number;
  note?: string;
  status: TimesheetStatus;
  /** Set only once the browser has actually submitted approveHours on-chain. */
  onchainTxHash?: string;
  updatedAt: string;     // ISO 8601
}
```

The five-state model is the whole point: it makes visible that the backend is a staging area and the chain is the authority.

### `[NEW]` `services/backend/src/timesheets/timesheets.controller.ts`

| Method | Route | Guard | Purpose |
|---|---|---|---|
| `GET` | `/timesheets?workerKey=&period=&status=` | Employer | Filterable list |
| `POST` | `/timesheets` | none | Worker submits a draft |
| `PATCH` | `/timesheets/:id` | none | Worker edits their own draft |
| `PATCH` | `/timesheets/:id/mark-pending-onchain` | Employer | **Renamed.** Employer intends to approve |
| `PATCH` | `/timesheets/:id/record-onchain` | Employer | Store the tx hash after the wallet signs |
| `PATCH` | `/timesheets/:id/reject` | Employer | With a reason |

> **The rename matters.** The original `/approve` implied this endpoint approves hours. It does not — `approveHours` on-chain does, and only D's app can trigger it. Anyone reading `/approve` would reasonably assume the backend is authoritative, and build the wrong thing on top of it.

## 2.6 Notifications module

Unchanged in shape. Two additions:

- A `type` field: `'payment-due' | 'unconfirmed-period' | 'timesheet-submitted' | 'offer-pending'`
- `readAt?: string`, so the UI can show unread counts

`GET /notifications?workerKey=` — a worker sees only their own; the employer sees all. Guard accordingly.

## 2.7 Reporting module

### The gap in the original plan

It promised "compliance metrics" without saying where the data comes from. The backend has no chain access unless we give it some.

**It reads the indexer over GraphQL** — plain HTTPS, no SDK, fully within the rules.

### `[NEW]` `services/backend/src/reporting/indexer.client.ts`

A thin `fetch` wrapper around `INDEXER_URL`. No Midnight packages.

```ts
@Injectable()
export class IndexerClient {
  private readonly url = process.env.INDEXER_URL ?? '';

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new ServiceUnavailableException(`Indexer returned ${res.status}`);
    const body = await res.json() as { data?: T; errors?: unknown[] };
    if (body.errors?.length) throw new ServiceUnavailableException('Indexer query failed');
    if (!body.data) throw new ServiceUnavailableException('Indexer returned no data');
    return body.data;
  }
}
```

Cache responses for ~30 seconds. Reports are read constantly during a demo and the numbers do not move that fast.

> **Coordinate with E.** They are writing the same queries for the auditor view. Agree the shapes once; do not discover on the last day that you disagree about what "confirmed" means.

### `[NEW]` `services/backend/src/reporting/reporting.controller.ts`

| Route | Guard | Returns |
|---|---|---|
| `GET /reports/summary` | Employer | Headcount, confirmed vs unconfirmed period counts, contribution-verified count |
| `GET /reports/unconfirmed` | Employer | Every unconfirmed period, worst first — **the screen the demo uses** |
| `GET /reports/health` | none | `{ status, indexerReachable }` for the devops slide |

**Every reporting response must be salary-free.** It aggregates booleans, never amounts. There are no amounts to aggregate — the chain does not have any.

---

# Part 4 — Tests

The original plan had none. Four are worth writing, and the first two are the ones that protect the product:

1. **`GET /directory` without a token returns 401.** This is the test that stops us shipping a deanonymization API. Write it first.
2. **`DirectoryEntry` has no salary-like field.** Assert the key set. It fails loudly the day someone adds one.
3. **A timesheet cannot reach `approved-onchain` without a tx hash.** Guards the boundary between staging and authority.
4. **The indexer client fails gracefully** when the indexer is unreachable — the demo must not white-screen because a testnet is down.

```bash
npm run test -w @nightshift/backend
```

---

# Part 5 — Verification

### Automated

```bash
npm install                                   # root, once, after the workspaces fix
npm run typecheck -w @nightshift/backend
npm run build -w @nightshift/backend
npm run test -w @nightshift/backend
```

### Manual

```bash
npm run start:backend
```

```bash
# Must return 401 — if this returns data, STOP and fix the guard
curl -i http://localhost:3002/directory

# Must return 200
curl -H "Authorization: Bearer $EMPLOYER_API_TOKEN" http://localhost:3002/directory

# No auth needed
curl http://localhost:3002/reports/health
```

**The first curl is the important one.** If an unauthenticated `GET /directory` ever returns data, nothing else in this service matters.

---

# Part 6 — What is deliberately not built

Say these out loud rather than letting a judge find them:

| Not built | Why | If asked |
|---|---|---|
| A real database | In-memory is fine for a demo | "Restarting loses off-chain data. The chain is unaffected — that is the point of the split." |
| Real authentication | Shared bearer token | "Enough to prove the directory is not public. Production needs proper identity." |
| Rate limiting | Time | Acknowledge it |
| Encryption at rest | Time | Acknowledge it |

---

# Part 7 — Summary of changes from the original plan

| # | Change | Severity |
|---|---|---|
| 1 | Add `services/*` to root workspaces | **Blocker** — every command in the original verification plan fails without it |
| 2 | `EmployerGuard` on the whole directory controller | **Critical** — an open directory deanonymizes the public chain |
| 3 | Fail-closed guard when the token is unset | **Critical** — the classic misconfiguration |
| 4 | Rename `/approve` → `/mark-pending-onchain`, add five-state model | High — the old name claims authority the backend does not have |
| 5 | Specify the indexer as the reporting data source | High — was unspecified, and it is the only legal way to read the chain |
| 6 | DTOs plus a global `ValidationPipe` | Medium |
| 7 | Restrict CORS to known origins | Medium |
| 8 | Four tests, auth-first | Medium |
| 9 | `.env.example`, explicit tsconfig overrides for decorators | Low |
| 10 | `DELETE /directory/:workerKey` | Low — the only right-to-erasure in the system |

**What the original got right**, and it is not a short list: the module decomposition, the correct dependency on `@nightshift/shared` alone, quoting the no-SDK rule accurately, keeping salaries off the backend, and having a verification plan at all. The structure was sound. It needed a build fix and a security fix, not a rewrite.

---

*Rules: [CLAUDE.md](../CLAUDE.md) · [rule book](../tasks/RULEBOOK.md) · D's task: [04-employer-app.md](../tasks/04-employer-app.md) · Why any of this is private: [01-contract-EXPLAINED.md](../A_docs/01-understanding-the-contract.md)*
