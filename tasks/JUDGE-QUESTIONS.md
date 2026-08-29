# Questions the judges will ask

*Prep for the whole team. Read it once before the demo, skim it right before.*

**The single most important rule on this page: when you do not know, say so.** Judges have seen a hundred teams bluff. A team that says *"we did not build that, here is why, and here is what we would do"* scores higher than one that waffles. Several answers below are deliberately admissions.

---

## The one-liners

If you only remember four sentences, remember these.

**What is it?**
> Payroll where the salary is sealed on a public blockchain — unreadable by anyone, including us — and each payday the worker proves they were paid the right amount without revealing what that amount is.

**Why does it matter?**
> The blockchain records one fact per month: paid correctly, or not confirmed. An underpaid worker gets permanent public evidence, and nobody's salary is ever exposed.

**What is the demo?**
> An employer underpays. The worker literally cannot confirm it — the proof will not verify. That month stays publicly blank forever while the salary stays sealed.

**Why blockchain?**
> Because the claim is "nobody can read this and nobody can change it, including us." Any system with an administrator cannot make that claim.

---

# Part 1 — The hard ones

## "Why not just use a database?"

**This is the question. Expect it. It is fair.**

> A database has an administrator. That person can read every salary, and can edit the agreed rate after the fact. Our entire claim is that **nobody** can — not the employer, not us, not a hacker who gets our credentials, because there is nothing to steal.
>
> Two things follow that a database cannot do. First, the agreed salary is *binding*: once sealed, neither side can pretend a different number was agreed, and that is enforced by mathematics rather than by our promise. Second, an auditor needs no permission from us. They read the public chain themselves. With a database they would have to trust that we showed them everything.

If they push — *"but you could just log it properly"* — the honest follow-up:

> Logging is a promise. This is a property. The difference matters exactly when the company has an incentive to break the promise, which is precisely when payroll fraud happens.

## "Can't the employer just pay cash off the books?"

> Yes, completely. NightShift binds what was agreed **on-chain**; it cannot see around itself.
>
> What it fixes is the case where a formal agreement exists and the employer quietly deviates from it — underpaying, or declaring a lower salary to social security. That is the common fraud, because it is deniable. Fully informal work is a different problem and we do not claim to solve it.

## "Isn't the salary revealed once someone confirms a payment?"

**No, and this is your strongest technical point. Make sure it lands.**

> No. The confirmation publishes one boolean. The amount, the rate, and the hours all stay inside the proof and never reach the chain.
>
> This is different from most zero-knowledge auction designs, where the winning bid has to be revealed. Here there is no reveal phase at all, because there is no competition to resolve — just a check against a value that was sealed at hiring.

Then invite them to check:

> Our auditor view needs no login. Open it and look for a salary. There is nowhere for one to be.

## "What stops a worker lying about what they received?"

> They cannot confirm an amount that does not match the sealed agreement — the proof simply will not verify, which is what you saw in the demo.
>
> The reverse is possible: a worker could refuse to confirm a payment they *did* receive, out of spite. We do not solve that. The system proves payments **correct**; it cannot force a confirmation. That dispute goes off-chain like any other.

## "Why Midnight rather than Ethereum?"

> Midnight has private state and selective disclosure as first-class features — a contract can compute on data it never sees. On a transparent chain we would have to build that layer ourselves.
>
> Concretely, `persistentCommit` and the witness model are standard library here. We did not invent them, which was deliberate.

## "Did you write the cryptography yourselves?"

> No — and we would consider it a red flag if we had. The commitments are Midnight's `persistentCommit`, which is SHA-256 based, and the identity derivation is `persistentHash` with a domain separator. Both are documented standard library.
>
> What we built is the design: which values get sealed, what each circuit asserts, and what is allowed to reach the public ledger.

---

# Part 2 — Technical

## "How does the privacy actually work?"

Keep it to three sentences.

> The salary is stored as a commitment — a hash of the salary plus a large random salt. The hash hides it, and the salt is what stops someone simply hashing every plausible salary until they find a match.
>
> The check that a payment is correct happens inside a zero-knowledge circuit that runs on the worker's own device. The network verifies a proof and never sees the inputs.

## "What is a salt, and why do you need one?"

> A large random number mixed in before hashing. Without it a hash is useless here: there are maybe a hundred thousand plausible salaries, so an attacker hashes all of them and compares. That takes under a second. The salt makes the input unguessable.

## "Where do the private keys and salts live?"

> On the user's own device, in encrypted local storage. They are never transmitted. Our backend never receives one.
>
> That is not a policy — it is the architecture. If a server held a salt, that server could read the salary, and the product would be a normal payroll app with extra steps.

## "What happens if someone loses their salt?"

**An honest limitation. Do not dress it up.**

> They can no longer confirm payments, because they cannot reproduce the sealed agreement. Their **money is unaffected** — that is a separate transfer — but their ability to prove future payments is gone until they are re-hired with a new commitment.
>
> Encrypted local storage handles the ordinary case of closing a browser. It does not handle a lost laptop. A production version needs a proper recovery story, and we have not built one.

## "Can the employer see the salary they are paying?"

> Yes — they agreed it and they generated the commitment, so they hold the rate and the salt for their own employees. What they cannot do is **change** it afterwards, or read anyone else's.
>
> Our employer app deliberately has no salary column in the team list, because the contract does not expose one.

## "How does hourly work?"

> The rate is sealed; the hours are public. The circuit checks `amount == hours × rate`. Hours are not sensitive — the employer already knows them — and only the rate is guarded. A salaried worker is the same circuit with hours set to 1.

## "What are the circuits, briefly?"

> Six: seal the salary at hiring, let the worker verify the seal matches what they were told, approve a timesheet, confirm a payment, prove the social-security declaration used the real salary, and end employment.

---

# Part 3 — Attack questions

Judges who know cryptography will probe. These are the ones worth rehearsing.

## "Could the employer seal a different number than they promised?"

> They could try, and the worker catches it immediately. `acceptHire` recomputes the commitment from the number the worker was actually told. If it does not match what is on the chain, the transaction fails and they find out **before day one** rather than on payday.

## "Could someone impersonate the employer?"

> No. Identity is not self-declared — it is derived by hashing a secret held on the device. To act as the employer you would need their secret.
>
> Midnight does have a function called `ownPublicKey()` that looks like it identifies the caller, but it is a witness: the caller's own machine chooses what it returns. Using it for authentication is the documented mistake in this ecosystem, and we do not use it anywhere in an authentication path.

## "The proof runs on the user's own machine. Why can't they just lie to it?"

**The sharpest question a technical judge can ask. Whoever answers must know this cold.**

> Because a proof guarantees the **computation** was honest — not that the **inputs** were. Those are different things, and the gap between them is where every zero-knowledge design lives or dies.
>
> You can absolutely feed a circuit whatever numbers you like. What you cannot do is make an assertion pass that the mathematics will not allow.
>
> Concretely: if we had written `assert(ownPublicKey() == employerKey)`, an attacker just makes their machine return `employerKey` and gets a perfectly valid proof. The proof would even be *honest* — it truthfully says "the value I supplied equals employerKey." It is worthless, because nothing stopped them choosing that input.
>
> We write `assert(hash(mySecret) == employerKey)` instead. They can still choose the secret, but now they would need one whose hash equals `employerKey`, and hashes do not run backwards.

Then give them the general rule, because it shows the design was deliberate rather than lucky:

> **Every circuit is only as strong as its anchor to public state.** Each of ours contains at least one assertion tying a caller-chosen input to something already on the chain they could not have manipulated — the employer's key, the commitment sealed at hiring, the hours the employer approved.

If they push on `confirmPayment` specifically:

> The worker picks the amount **and** the rate, so `amount == hours × rate` on its own proves nothing — they would just pick two numbers that agree. What makes it real is the line above it, which checks the rate opens the commitment stored at hiring. To fake a payment they would need a different rate and salt that hash to the same commitment.

## "Could an attacker brute-force the commitment?"

> Not meaningfully. They would need to guess the salary and a 32-byte random salt together. That search space is astronomically large.
>
> If we had hashed the salary alone it would be trivially crackable, which is exactly why the salt is there.

## "What can an observer of the chain actually learn?"

**Answer this proactively during the demo, before anyone asks.**

> They can see that two pseudonyms have an employment relationship, roughly when it started, how many periods were confirmed, which ones were not, and the approved hours. They cannot see any salary, any payment amount, or anyone's real identity.
>
> So content is private and participation is not. We think that is the right trade for payroll, and it is a real limitation rather than something we hid.

## "Can transactions be replayed or double-confirmed?"

> A period cannot be confirmed twice — the contract checks and rejects it.

---

# Part 4 — Product and honesty

## "Who would actually use this?"

> Two entry points. Employers in jurisdictions with pay-transparency or social-security reporting obligations, who want to prove compliance without publishing individual salaries. And workers in places where under-declared social-security contributions are common and currently uncheckable.
>
> Honestly, adoption is the hard problem here, not the cryptography.

## "Is the social-security part real?"

> The circuit is real and it compiles. Whether a national fund would run a node is a business-development question we cannot answer.
>
> But the worker-side value does not require the fund to adopt anything: the worker holds a proof that their employer committed to salary X at hiring and declared Y. That is evidence in a dispute or an inspection regardless.

## "How much of this did you build this weekend?"

**Answer precisely. Vagueness reads as exaggeration.**

> The Compact contract, the shared API layer with a working in-memory implementation, three frontends, and the test suite. We used the official Midnight toolchain and standard library.
>
> What is mocked: [say exactly what]. What is not built: [say exactly what].

## "What would you do next?"

> Salt recovery, because a lost device currently costs the worker their ability to confirm. Then shielded recurring payments — right now a monthly payment history could be linkable, and closing that matters before this is real.

## "What surprised you?"

A good answer here shows you actually built it.

> Compact has no division operator. We found out by compiling. Our social-security circuit used division and could never have worked — we restated it as a multiplication on the other side of the comparison. It is the kind of thing you only learn from the compiler, and it is why we spiked the arithmetic before writing the real contract.

---

# Part 5 — Questions to be honest about

These have no good answer. Say so plainly and move on — do not improvise.

| Question | The honest answer |
|---|---|
| "Is this audited?" | No. It is a hackathon build using documented primitives. |
| "Does it work on mainnet?" | We ran it on [local devnet / preview]. We have not deployed to mainnet. |
| "What about gas costs at scale?" | We have not measured it. |
| "What if the worker never confirms?" | The period stays unconfirmed. We cannot distinguish "not paid" from "did not bother". |
| "Is the salt recovery solved?" | No. It is our top next step. |
| "Have you talked to real employers?" | [Say the truth.] |

> A limitation you name yourself is a strength. A limitation a judge finds is a hole.

---

# Part 6 — Who answers what

Agree this before you present. Nothing looks worse than three people starting to answer at once, or all four looking at each other.

| Topic | Owner |
|---|---|
| Circuits, commitments, why not a database | **A** |
| SDK, deployment, why Midnight | **B** |
| Worker flow, salt storage, the failure screen | **C** |
| Employer flow, fees, why no edit-salary button | **D** |
| The auditor view, what the chain shows, privacy limits | **E** |
| Product, adoption, next steps | Lead |

If a question is not yours, say **"that is [name]'s area"** and hand over. It reads as a team that knows its own build.

---

## The last thing

Every question above is really one question: **is the privacy real, or is it decoration?**

Your best answer is not a sentence. It is the auditor view — no login, no wallet, no permission — with a month marked ✗ and nowhere on the screen for a salary to appear.

Show it. Then let them try to find one.
