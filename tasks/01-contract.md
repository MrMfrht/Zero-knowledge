# Task A — The smart contract

**You are building:** `payroll.compact` — the rules that everything else in the project obeys.

**Your folder:** `packages/contract/`
**Your branch:** `contract` (branched from `dev`)

---

## Do you need WSL?

# YES

There is no Windows version of the Compact compiler. It only exists for Linux and macOS.

- **On Mac or Linux?** You are fine. Skip to Setup.
- **On Windows?** You need WSL (a Linux system inside Windows). Instructions below.
- **Cannot install WSL** (locked work laptop, no admin rights)? Use **GitHub Codespaces** — free, runs Linux in your browser, everything below works unchanged.

---

## Why this task exists

Everything in this project depends on one idea: **the agreed salary is sealed into a value that nobody can read and nobody can change.**

Your contract is what enforces that. It decides:

- What the blockchain stores (only sealed values and yes/no facts — never a salary)
- Who is allowed to do what
- What happens when an employer pays the wrong amount

That last one is the whole demo. If an employer sends 4,000 when 5,000 was agreed, **your contract must refuse to record it as paid.** Not warn. Refuse.

You are also the person who has to *explain* this. If a judge asks "why is the salary a sealed value instead of a normal field?", you answer. Nobody else can.

---

## Setup

### Windows only — install WSL first

Open PowerShell **as administrator**:

```powershell
wsl --install -d ubuntu
```

Takes 5–15 minutes and restarts things. When it finishes, it asks you to create a Linux username and password. The password will not show as you type — that is normal.

Everything from here happens **inside the Ubuntu terminal**, not PowerShell.

### Everyone — install the compiler

```bash
sudo apt-get update && sudo apt-get install -y unzip curl
```

> ⚠️ `unzip` is missing from a fresh Ubuntu and the installer silently fails without it. Do not skip this line.

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source ~/.bashrc
compact update 0.31.1
```

> ⚠️ If that last command fails halfway, it leaves a broken folder behind and every retry then says *"already installed"* while the compiler is missing. Fix it with:
> `rm -rf ~/.compact/versions/0.31.1` then run `compact update 0.31.1` again.

Check it worked:

```bash
compact --version        # should print: compact 0.5.2
compact compile --version # should print: 0.31.1
```

Also install the [VS Code Compact extension](https://docs.midnight.network/compact/compilation-and-tooling/vscode-plugin).

### ⚡ The one flag that saves you hours: `--skip-zk`

```bash
compact compile --skip-zk src/payroll.compact src/managed
```

A normal compile also generates zero-knowledge proving keys, which is slow — minutes, every time. `--skip-zk` skips that step and checks only that your code is **correct**, which takes seconds.

**Use `--skip-zk` for every single compile while you are writing.** Drop it only when you need the real proving keys, which is when you are ready to hand `managed/` to B.

You will compile dozens of times today. This flag is the difference between a fast day and a miserable one.

> **Where to put the repo:** keep it inside Linux (`~/nightshift`), **not** on your Windows Desktop. Compiling across `/mnt/c` is painfully slow. Open it with VS Code's WSL extension and it feels completely normal.

---

## Step 1 — Read these three pages

Do not skip this. Compact does not work like Solidity or any language you know.

1. [Writing a contract](https://docs.midnight.network/compact/reference/writing) — the basic shape
2. [Ledger data types](https://docs.midnight.network/compact/data-types/ledger-adt) — what you can store
3. [Smart contract security](https://docs.midnight.network/compact/smart-contract-security) — commitments, and why `ownPublicKey()` must never be used for login

Then read the [Private Reserve Auction example](https://docs.midnight.network/examples/contracts/private-reserve-auction) line by line. Ask yourself why one of its variables is called `publicBid`. The answer — **anything you put in a `Map` is visible to the whole world** — is the single most important fact in this project.

---

## Step 2 — Run the hello-world example

```bash
npx create-mn-app my-first-app
```

Choose **Contract**, then **hello-world**. Compile it. Deploy it. Call it.

Do this before writing anything of your own. It turns "deploy a contract" from a scary idea into something boring, and boring is what you want by day two.

---

## Step 3 — Write the contract, one circuit at a time

Compile after **every single circuit.** Do not write all six and then compile — you will drown in errors.

```bash
compact compile --skip-zk src/payroll.compact src/managed
```

**Always `--skip-zk` while writing** — seconds instead of minutes. See the note in Setup.

The circuits you need, in this order:

| Circuit | What it does |
|---|---|
| `hire` | Employer stores the sealed salary for a worker |
| `acceptHire` | Worker checks the sealed value really is the number they agreed |
| `approveHours` | Employer approves a timesheet (hours are public on purpose) |
| `confirmPayment` | **The important one.** Worker proves the money received matches the sealed salary |
| `proveContribution` | Proves social-security was calculated on the real salary |
| `endEmployment` | Marks someone as no longer employed |

A full draft with explanations is in [the build plan, Part 2](../Ideas/NightShift_Private_Payroll_Midnight.md#part-2--the-contract). **It has not been compiled.** Treat it as a starting point, not as correct code.

### Arithmetic — already spiked, read this before writing a circuit

The lead compiled four throwaway contracts to settle how Compact arithmetic
behaves. Full write-up: **[SPIKE-ARITHMETIC.md](../packages/contract/SPIKE-ARITHMETIC.md)**. The three results that change what you write:

1. **`confirmPayment` is fine as designed.** `amount == (hours as Uint<64>) * rate` compiles, and it is safe — Compact widens the product to a ~128-bit range instead of wrapping, so there is no overflow to exploit.
2. **Never store a product.** Assigning `hours * rate` to a `Uint<64>` is a compile error, because the product's range is `Uint<0..(2^64-1)^2>`. Comparing is fine; storing needs a cast that could truncate.
3. **Compact has no `/` or `%`.** Division is a parse error. `proveContribution` in the build plan used division and **cannot compile as written.** Restate it by cross-multiplying:

```compact
// declared == rate * pct / 100      ← impossible, no division operator
assert(declared * 100 == rate * (contributionRate as Uint<64>), "under-declared");
```

**Rule for the whole contract: never write `/` or `%`.** Move the division to the other side as a multiplication.

Also: compile with `--skip-zk` while iterating. It skips proof-key generation and turns a minutes-long build into seconds.

---

## Step 4 — Compile and commit the output

```bash
compact compile src/payroll.compact src/managed
```

**Note there is no `--skip-zk` here.** This is the one time you want the slow build: it produces the real zero-knowledge proving keys, which B needs. Expect it to take minutes.

This produces a `managed/` folder containing TypeScript files and proof keys.

**Commit `managed/` to git.** This is important: it is how C, D and E use your contract without ever installing the compiler. They import plain TypeScript. You are their only source of it.

Every time you change the contract, recompile and commit the new `managed/`, then tell the team.

---

## How your work connects to everything else

```
   YOU
   payroll.compact
        │  compile
        ▼
   packages/contract/src/managed/   ← TypeScript files + proof keys
        │
        ▼
   B wraps it in packages/api/
        │
        ├──► C's worker app
        ├──► D's employer app
        └──► E's auditor view
```

You are at the top. **Nobody can finish without you, but nobody is blocked waiting for you either** — C, D and E build against a fake version of the API while you work. So take the time to get it right.

The person who most needs you is **B**, who wraps your `managed/` output into the real API. Talk to them early about what your circuits are called and what arguments they take.

---

## Done when

- [ ] `compact compile` succeeds with no errors
- [ ] A **wrong salt** is rejected
- [ ] A **wrong rate** is rejected
- [ ] A **wrong amount** is rejected — this is the demo, test it first
- [ ] Wrong hours are rejected
- [ ] `managed/` is committed to git
- [ ] You can explain out loud why the salary is a commitment and not a normal field

---

## Rules you must not break

1. **Never put a salary or payment amount in a `Map`, `Set`, or ledger field.** Those are public. Store `persistentCommit(value, salt)` instead.
2. **Never use `ownPublicKey()` to check who is calling.** It is controlled by the caller's own machine — anyone can fake it. Identity comes from hashing a secret: `persistentHash([pad(32, "nightshift:pk:"), _sk])`.
3. **Never trust a value a witness gives you** without checking it against something. Witnesses run on the user's computer and are not verified.
4. **`disclose()` does not hide anything.** It is the opposite — it tells the compiler "yes, publish this."

The reasoning behind all four is in [the privacy model](../docs/midnight-privacy-model.md). Read it once.

---

## Stuck?

- Compiler error you do not understand → [Troubleshoot compiler errors](https://docs.midnight.network/troubleshoot/compiler-errors)
- "Is this valid Compact?" → **Ask AI** on [docs.midnight.network](https://docs.midnight.network/). Never guess.
- Design question → [the privacy model](../docs/midnight-privacy-model.md), then the lead
