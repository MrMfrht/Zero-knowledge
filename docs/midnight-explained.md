# Midnight, Explained From Zero

*A complete guide for someone who does not know much about crypto. This document covers what the Midnight network is, how its two tokens work, the honest problems with its design, and real examples of how it would be used. It also includes the important questions that came up along the way, because they are the same questions most beginners would ask.*

---

## Part 1: The Background You Need First

### What is a blockchain?

A blockchain is a shared record book that no single person controls. Thousands of computers around the world each keep a full copy of it. When someone adds a new entry (for example, "Ali sent 5 coins to Sara"), all the computers check that the entry follows the rules, and then all of them write it down. Because everyone has the same copy, nobody can secretly change history or spend money they do not have.

The most famous blockchains are Bitcoin, Ethereum, Solana, and Cardano.

### What is a dApp?

A dApp means "decentralized application." It is an app whose core logic runs on a blockchain instead of on one company's servers. The rules of the app are written in code called a **smart contract**, which lives on the blockchain and runs exactly as written. Nobody can quietly change the rules, and nobody can shut it down.

A **hybrid dApp** mixes two worlds. The parts that need to be trustworthy and cheat-proof (like who owns what, or moving money) run on the blockchain. The parts that just need to be fast and cheap (like search, images, and user profiles) run on normal servers, like any website. Almost every real dApp is hybrid, because putting everything on a blockchain is slow and expensive.

There is a second meaning of "hybrid" too: an app that uses **several different blockchains at once** — for example, storing value on Bitcoin, running logic on Ethereum, and doing fast operations on Solana. Midnight connects to this second meaning, as you will see below.

### The big problem: blockchains are completely public

Here is the issue that Midnight exists to solve.

On a normal blockchain, **everything is visible to everyone, forever**. If a company paid its salaries on Ethereum, anyone in the world could look up every employee's salary. If a business bought supplies on a public chain, its competitors could see exactly what it paid and how much it bought. If you received a loan, everyone could see your balance.

This is why most serious businesses have refused to use blockchains. The technology is trustworthy, but the total lack of privacy is a dealbreaker.

At the same time, the fully-hidden alternative (privacy coins like Monero, which hide everything from everyone) is a dealbreaker for a different reason: regulators, auditors, and tax authorities cannot see anything either, so businesses cannot legally use them.

What businesses actually need is something in between: **hide the details from the public, but prove the rules were followed, and be able to show the details to an auditor when required.**

That "in between" is what Midnight is built for.

---

## Part 2: What Midnight Is

**Midnight is a privacy-focused blockchain created by Input Output Global (IOG), the company behind Cardano.** It works as a companion network (a "sidechain" or "partner chain") to Cardano: Cardano provides security and an ecosystem, and Midnight provides private smart contracts.

Its launch timeline, briefly:

- The token distribution ("Glacier Drop") ran from late 2025 into 2026.
- The main network launched on **March 31, 2026**, in a "federated" form, meaning a fixed set of approved organizations run it for now. Validators (the organizations running the network computers) include names like Google and MoneyGram.
- As of mid-2026 it is still described as being in a beta phase, with more decentralization planned in later phases.
- The stated ambition is to eventually offer privacy services to other blockchains too — Ethereum, Solana, Bitcoin, XRP — acting as a privacy layer "for everyone," not just for Cardano.

### The key idea: programmable privacy

Midnight does not hide everything, and it does not show everything. Instead, **the developer of each app decides which information is public and which is private.**

To make this work, Midnight keeps two layers of records:

1. **A public layer.** This shows that transactions happened and that the rules were followed. Everyone can see this.
2. **A shielded (private) layer.** This holds the actual sensitive contents — amounts, names, prices, terms. Only the people involved can see this.

### The magic trick: zero-knowledge proofs

The technology connecting the two layers is called a **zero-knowledge proof (ZKP)**. It sounds impossible, but it is real mathematics: it lets you **prove a statement is true without revealing the information behind it**.

An everyday comparison: imagine proving to a bartender that you are over 18 **without showing your ID card** — no name, no birthdate, no photo — and the bartender is still mathematically certain you are over 18. That is what a zero-knowledge proof does.

On Midnight, the network uses these proofs to verify that every private transaction is valid ("the sender really had the money, the contract rules were really followed") without the network ever seeing the private details.

### Selective disclosure: the part built for regulators

The final piece: if an auditor, tax authority, or regulator legitimately needs to see your records, **you can grant them a special viewing key** that opens only your data to only them. The public still sees nothing.

Charles Hoskinson (Cardano's founder) describes this as walking the line between privacy and compliance. Privacy purists dislike this — they see any auditor access as a weakness. Businesses see it as the entire point, because without it they could not legally use the system.

---

## Part 3: The Two Tokens — NIGHT and DUST

This is the most confusing part of Midnight for newcomers, so it is worth taking slowly.

Midnight uses two things: **NIGHT** and **DUST**. Only one of them is a coin in the normal sense.

### NIGHT — the asset

- Public, visible, and tradeable. You can buy it, sell it, and hold it.
- Fixed starting supply of 24 billion tokens.
- Used for governance (voting on the network's future) and for paying the validators who run the network.
- Think of it as **capital** — like owning equipment.

### DUST — the fuel

- **Not tradeable. Not transferable. You cannot buy it, sell it, or send it to anyone.**
- The only way to get DUST is to hold NIGHT. Holding NIGHT automatically generates DUST over time, like a battery slowly recharging.
- DUST is what you actually spend when you make transactions or run smart contracts.
- DUST also **decays**: if you do not use it, it slowly disappears. You cannot hoard years of it.
- DUST is shielded (private), so your fee payments reveal nothing about you.

The relationship in one sentence: **hold the asset, and it produces the fuel.**

A good mental model is a mobile data plan. Your subscription (NIGHT) gives you a data allowance (DUST) that refills over time. Browsing uses up the data. Nobody on the other end "receives" your gigabytes — they are simply consumed.

---

## Part 4: The Questions — and the Honest Answers

These are the exact questions that came up while learning this, kept here because they are the questions almost everyone asks. The answers include the honest weaknesses, not just the marketing.

---

### ❓ Question 1: "So NIGHT and DUST are two coins the Midnight system works on?"

**Short answer: two tokens, but only one is really a coin.**

NIGHT is a normal crypto asset: tradeable, holdable, with a market price. DUST is not a coin at all in the usual sense — it cannot be bought, sold, or transferred. It is a private, self-refilling, self-expiring resource that exists only to pay for network usage. This split is deliberate, and the reasons appear in the next questions.

---

### ❓ Question 2: "In transactions, I don't pay DUST to the other person — I just lose it, right?"

**Short answer: exactly right. DUST is consumed, not transferred.**

When you make a transaction, your DUST balance goes down and **nobody's** goes up. It is destroyed, like fuel burned in an engine. The person you transact with receives whatever you actually sent them (tokens, an updated contract, etc.) — but they never receive your DUST.

This is different from other blockchains. On Ethereum or Bitcoin, transaction fees are payments: they go to the people running the network. On Midnight, fees have no recipient at all.

This raises an obvious question: **then how do the network operators get paid?** Answer: from the NIGHT side. Validators earn newly created NIGHT tokens as a reward for producing blocks. So there are two completely separate money flows:

1. Users burn DUST to use the network.
2. Validators earn NIGHT from the protocol itself.

The two flows never touch. This separation is intentional and privacy-driven: if your fee went directly to a validator, that payment would be a visible trail linking you to your transaction, and the fee size would hint at what your private transaction was doing. Burning an invisible resource leaves no trail.

One consequence worth knowing: because validators are paid in newly created NIGHT, **the supply of NIGHT grows over time**. The 24 billion figure is a starting point, not a permanent ceiling on dilution.

---

### ❓ Question 3: "What is the actual benefit? If I'm a business and I don't have much NIGHT now, how will I get it later?"

**Short answer: the design solves cost *predictability*, not cost *acquisition*. Your objection is valid.**

Here is the genuine benefit. On Ethereum, a business pays fees in ETH at whatever ETH's market price is that day. If ETH doubles, the business's operating costs double, and there is nothing it can do about it. Costs are a recurring expense tied to a volatile market.

On Midnight, a business buys NIGHT **once**, at a known price. From then on, its NIGHT generates a steady stream of DUST — a fixed number of transactions per day — **no matter what happens to NIGHT's market price afterward**. A one-time purchase with predictable output, like buying a server instead of paying a metered electricity bill. Finance departments strongly prefer this.

But the objection stands: **there is no free entry.** If you do not have NIGHT, you must buy it at market price from people who already hold it. If you need more capacity later, you must buy more — possibly at a higher price, precisely because demand for the network rose. The cost barrier is real and it is paid upfront.

The planned solution to this is the **DUST Capacity Exchange**: a marketplace where NIGHT holders who are not using their DUST generation can rent it out to businesses that need capacity but do not want to buy the asset. This is like renting cloud computing instead of buying hardware, and it is the piece that makes the business story complete.

The catch: as of August 2026, this exchange is **still on the roadmap, not live**. The mechanism that answers "how does a newcomer get capacity?" does not exist yet.

---

### ❓ Question 4: "Won't the price of NIGHT affect DUST anyway? If NIGHT's price crashes, doesn't everyone get unlimited DUST?"

**Short answer: nobody gets unlimited DUST — but cheap NIGHT does make attacking the network cheap, and that is a real weakness.**

Why "unlimited" is wrong: DUST generation is defined in tokens, not in dollars. The rule is roughly "one NIGHT produces a fixed amount of DUST per day." A price crash does not change that rule. Since the amount of NIGHT is capped, the total DUST the whole network can ever produce per day is also capped. The network's total capacity is fixed regardless of price.

What a price crash **does** change: the dollar cost of buying a share of that fixed capacity. If NIGHT falls 90%, buying enough NIGHT to control 1% of the network's throughput becomes 90% cheaper. So an attacker who wants to flood the network with junk transactions can do it cheaply when the price is low. Network security effectively depends on the token price staying healthy — a known weakness that many blockchains share in different forms.

There is a deeper structural point here. Ethereum has a self-correcting defense: when the network gets congested, fees automatically rise within seconds, which makes spam expensive and throttles it. **Midnight has no such automatic throttle.** DUST regenerates at a fixed rate no matter how congested the network is. Capacity is rationed by who bought NIGHT in advance, not by who is willing to pay more right now.

This is the central tradeoff of the whole design: the fixed regeneration rate is exactly what gives businesses predictable costs, and it is also exactly what removes the automatic anti-congestion defense. You cannot have both at once.

---

### ❓ Question 5: "If NIGHT and DUST became the official money of the world, how could a poor person ever get rich?"

**Short answer: that is not actually Midnight's goal — but the question behind it is a serious, old economic question.**

First, the correction: Midnight is not trying to become world money. It is infrastructure for private smart contracts. NIGHT is closer to a **capacity license** (like owning a share of a network's bandwidth) than to currency. And DUST cannot be money by construction — it is non-transferable, so you could never buy bread with it.

But the underlying question — "in a system with a fixed money supply where the rich already hold most of it, how does anyone rise?" — is a classic economics debate that existed long before crypto.

The honest answer:

- **A fixed supply does not prevent earning.** You get money the way people always have: produce something others value — work, build, sell, teach — and money flows from them to you. The total number of units is fixed; who holds them is not.
- **What a fixed supply does change:** it rewards people for simply holding (their share never gets diluted, and in NIGHT's case, holding literally generates DUST), and it tends to make borrowing expensive. Since credit is historically the main ladder for people without capital, a fixed-supply world makes that ladder steeper. That is the strongest version of the concern, and it is legitimate.
- **Why it is not hopeless:** wealth concentration is never permanent. Fortunes get spent, split among heirs, and overtaken by new industries. And every real economy grows a lending and investment layer on top of its base money, whatever that money is, because people demand it.

So the mechanism for a poor person is the same as it has always been: produce value, get paid, keep some. A fixed money supply makes this harder at the margins. It does not make it impossible, and no token design will be the thing that decides whether social mobility exists.

---

## Part 5: Real Use Cases, Step by Step

These three examples show what Midnight is actually *for*. Each one follows the same pattern: **the public layer proves the rules were followed; the private layer holds the details the rules were applied to.**

---

### Use Case 1: Proving you qualify for a loan without revealing your finances

**The problem.** You want a loan from an on-chain lending service that requires a minimum income. On a normal blockchain, qualifying would mean exposing your financial life to the entire world. With a traditional bank, it means handing over your statements and hoping they protect the data.

**The flow on Midnight:**

1. Your bank gives you a **digital credential** — a cryptographically signed statement saying "this person's monthly income exceeds amount X." This sits in your wallet on your own device. It is not published anywhere.
2. The lending app has a public rule everyone can read: "borrowers must be above the income threshold."
3. When you apply, your wallet generates a **zero-knowledge proof** on your device: *"I hold a genuine credential from a recognized bank, and the income inside it is above the threshold."*
4. The proof goes to the network's private layer. The public layer records only: a valid application happened and the rules were satisfied.
5. Your DUST is consumed for the computation. (Generating these proofs takes real computing work, so this costs more DUST than a simple transfer — that is the price of privacy.)

**What the lender learns:** you qualify.
**What the lender never learns:** your actual income, your bank, your other assets, your identity.
**What the public ledger shows:** nothing personal at all.

---

### Use Case 2: A supply chain shared with your competitors

**The problem.** Imagine you are a distributor and you buy from three suppliers — who also sell to your competitors. Everyone would benefit from one shared, tamper-proof record of shipments and payments. But nobody wants rivals seeing their prices and volumes. This exact conflict has quietly killed most business blockchain projects: companies build a shared ledger, realize the shared visibility leaks their secrets, and go back to spreadsheets.

**The flow on Midnight:**

1. The group of companies deploys one shared contract.
   - **Public information:** which shipments exist, whether their quality certification is valid, whether payment cleared.
   - **Private information:** prices, quantities, contract terms, who bought from whom.
2. Supplier A ships goods to you. The transaction locks the sensitive details into the private layer and publishes only a proof: "this shipment follows the agreed rules — quantity within range, certification valid, payment terms met."
3. Your competitor sees on the public layer that a valid shipment occurred. **They cannot see what you paid or how much you bought.**
4. When an auditor or regulator later asks for your records, you grant them a **viewing key** scoped to your own transactions only. They verify everything against the same shared ledger — but they see only what you opened, and the public still sees nothing.

This selective disclosure for auditors is the feature that makes the system legally usable by real companies, and it is the main reason enterprises are Midnight's target market.

---

### Use Case 3: Paying salaries on a public network without revealing them

**The problem.** A company with twelve employees wants payroll on a blockchain — automatic, auditable, tamper-proof. But on a normal chain, anyone could watch the company's account and reconstruct every employee's salary. Employee A could look up employee B's pay. Competitors could read the company's entire cost structure.

**The flow on Midnight:**

1. The payroll contract keeps the employee list and salary amounts in its **private state**.
2. Each payday, the contract sends all twelve salaries as private transfers, and publishes one proof to the public layer: "this pay run was internally consistent — the total sent matches the total deducted, every recipient is on the authorized list, nobody was paid twice."
3. **The public ledger shows only:** a valid payroll transaction happened at this time. No amounts, no names, no number of employees.
4. Access is then given out precisely to whoever is entitled to it:
   - The company accountant gets a viewing key covering the whole payroll.
   - Each employee can prove **their own** salary to a landlord or bank — without revealing anyone else's.
   - The tax authority gets a disclosure covering exactly what the law entitles it to see.

---

## Part 6: Honest Limitations (as of August 2026)

A fair summary should include what is unfinished or uncertain:

- **The network is young.** Mainnet launched March 31, 2026, is run by a fixed set of approved validators rather than being fully open, and is still described as beta. Nobody should run real payroll on it this month.
- **The DUST rental market is not live.** The Capacity Exchange that would let businesses rent capacity instead of buying NIGHT is still a roadmap item.
- **Developers must learn a new language.** Midnight contracts are written in "Compact," its own language, which compiles into zero-knowledge circuits. Existing Ethereum code cannot simply be copied over.
- **Privacy costs computing power.** Zero-knowledge proofs are generated on the user's own device and take real time and processing power. Private transactions are heavier than normal ones.
- **No automatic congestion defense.** As explained in Question 4, the fixed DUST regeneration rate means the network lacks the self-adjusting fee mechanism other chains use against spam.
- **Supply grows.** Validator rewards are paid in newly created NIGHT, so holders are gradually diluted over time.
- **The compliance compromise cuts both ways.** The auditor-access design is what makes businesses able to use it — and what makes privacy purists distrust it.

---

## Part 7: The One-Paragraph Summary

Midnight is a blockchain, connected to Cardano, designed to fix the biggest reason businesses avoid blockchains: total public visibility. It uses zero-knowledge proofs — mathematics that proves rules were followed without revealing the underlying data — so that transactions can be private toward the public but provable toward auditors. It runs on two tokens: NIGHT, a tradeable asset you hold, and DUST, a private, non-transferable fuel that your NIGHT automatically generates and that gets destroyed (not paid to anyone) when you transact. This gives businesses predictable operating costs, at the price of an upfront purchase, a gradually inflating supply, and the absence of an automatic anti-spam fee market. Its natural uses are situations where independent parties need one shared, trustworthy record but cannot reveal their details to each other — private loan qualification, supply chains shared with competitors, confidential payroll — with the details always openable to regulators on demand.

---

*Prepared August 29, 2026. Network details (phases, live features, token figures) reflect the situation at that date and will change as the project develops.*
