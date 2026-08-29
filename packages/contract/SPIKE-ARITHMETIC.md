# Spike: Compact arithmetic

**Question:** can `confirmPayment` safely assert `amount == hours × rate`, and can
`proveContribution` assert `declared == rate × pct ÷ 100`?

**Run:** 30 August 2026, `compact compile 0.31.1`, language version `0.23`.
Four throwaway contracts, compiled for real. Everything below is a compiler
result, not a reading of the docs.

---

## Result 1 — The payment check compiles as designed ✅

```compact
export circuit checkPayment(hours: Uint<32>, rate: Uint<64>, amount: Uint<64>): [] {
    assert(amount == (hours as Uint<64>) * rate, "incorrect payment");
    result = disclose(amount);
}
```

Compiles clean. **No change needed** to the `confirmPayment` design.

## Result 2 — Multiplication widens the type, and will not narrow back ✅

Storing a product in a `Uint<64>` is rejected:

```compact
total = disclose((hours as Uint<64>) * rate);
```

```
Exception: expected right-hand side of = to have type Uint<64> but received
           Uint<0..340282366920938463426481119284349108226>
```

That bound is `(2^64−1)^2` — the compiler tracks the exact possible range of
every expression, and multiplying two 64-bit values gives it a ~128-bit range.

**Why this is good news.** In Solidity, `hours * rate` overflowing would wrap
around, and an attacker picks numbers that wrap to the value they want. Compact
cannot do that here: the comparison happens at the wider type, so a product too
big for `Uint<64>` simply never equals a `Uint<64>` amount, and the assertion
fails. **There is no wraparound to exploit.**

**The rule for A:** comparing a product is safe. *Storing* one needs an explicit
cast, and a cast can truncate — so avoid storing products at all. `confirmPayment`
only compares, which is why it is fine.

## Result 3 — Compact has NO division operator ⛔

This was the surprise, and it invalidates a circuit from the build plan.

```compact
assert(declared == rate * (contributionRate as Uint<64>) / 100, "under-declared");
```

```
parse error: found "/" looking for ",", "||", "&&", "==", "!=", "as", "+", "-",
             "*", "[", ".", "<", "<=", ">=", ">", "?", "=", "+=", or "-="
```

Read that operator list. There is no `/` and no `%`. **You cannot divide in
Compact**, at least not with an operator, in this version.

The build plan's `proveContribution` used division. As written, it cannot compile.

## Result 4 — The fix: cross-multiply ✅

Multiply both sides by 100 instead of dividing one side:

```compact
// declared == rate * pct / 100      ← impossible
// declared * 100 == rate * pct      ← same statement, compiles
export circuit checkContribution(declared: Uint<64>, rate: Uint<64>): [] {
    assert(declared * 100 == rate * (contributionRate as Uint<64>), "under-declared");
    ok = true;
}
```

Compiles clean, with a `sealed` ledger field and a constructor.

**One behavioural difference worth knowing.** The original would have truncated:
if `rate × pct` were not exactly divisible by 100, integer division silently
rounds down and a slightly-wrong declaration would pass. The cross-multiplied
form demands exactness.

For a contribution check that is the **better** behaviour — it is the stricter
statement, and "roughly the right contribution" is not a thing anyone wants to
prove. But it must be a deliberate product decision, not an accident: if real
payroll rounding is expected, the contract needs an explicit tolerance and the
UI needs to explain it.

---

## What this means for the build

| Circuit | Verdict |
|---|---|
| `confirmPayment` | ✅ Design is correct. Compile as planned |
| `proveContribution` | ⚠️ **Rewrite required.** Use the cross-multiplied form |
| Anything storing a product | Needs an explicit cast — avoid it |

**General rule for the whole contract: never write `/` or `%`.** If a design needs
division, restate it as multiplication on the other side of the comparison.

---

## Reproducing this

```bash
cd ~/spike
compact compile --skip-zk mul.compact out
```

`--skip-zk` skips proof-key generation, which makes the compile loop seconds
instead of minutes. Use it for every iteration and drop it only for the final build.

The four spike files are throwaways and are not committed — the results above are
what matters. Re-run them if the compiler version changes.
