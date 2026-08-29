# ProofGate — A Proposal for the Team
### Midnight Hackathon, August 2026

I'm putting this in front of you as one option, not a done deal — pressure-test it, take it apart, or tell me you've got something better. I'd rather build the strongest idea this group actually believes in than the one I happened to bring first.

**One-line thesis:** an AI agent can be granted permission to act on sensitive data without ever receiving the data that granted it — Midnight proves the permission, the AI never sees the reason.

## Track: AI Track (my recommendation, open to the group)

> *"Build AI applications that process sensitive information on the user's terms where models act on private data, and Midnight proves the rules were followed."*

I checked this against the actual event page rather than go from memory — that's the exact language. ProofGate is a direct implementation of it, not an adjacent fit.

**Why not the other four tracks**, for full transparency on how I got here:

| Track | Why I'm not pitching it |
|---|---|
| Mobile | Real device-native work (secure enclave, biometric binding) is a second full engineering surface — costly with 48 hours on the clock |
| Integrate Midnight | Requires an app that already exists to retrofit privacy onto — we don't have one, and I don't want to manufacture "prior work" to force the fit |
| Cross-Chain | Adds bridge/multi-ecosystem complexity on top of everything else — a second hard problem we don't need |
| Best Beginner Hack | Not an alternative — worth checking as a group whether we clear the >50% first-time-hackathon threshold, since it stacks on top of AI Track rather than competing with it |

## The Build

**The question ProofGate answers:** can an AI agent be authorized to act on private information without that information ever reaching it?

**Scenario: Ember & Oak Hospitality Group** — a hospitality operator with a flagship restaurant, a bakery counter, and a catering arm. An employee's role tier and unit assignment determine what they're authorized to access; an AI assistant needs to answer questions about a unit's operating data without ever being handed the employee's actual credentials.

**Private facts (never sent to the AI):**
```
EMPLOYMENT STATUS: Active
ROLE TIER: Shift Supervisor (tier 3)
UNIT ASSIGNMENT: Catering
```

**What a Compact contract checks, privately:**
```
employment_active == true
AND role_tier >= 3        (supervisor or above)
AND unit_assignment == CATERING
```

**What the application receives:**
```json
{ "authorized": true, "scope": "CATERING_OPS" }
```

Only then does the app release a scoped extract — Catering's vendor/COGS data or a KPI dashboard slice, the same deliverable types Ember & Oak's real case study already uses. The AI summarizes and answers questions from it. It never receives role tier, employment record, other unit assignments, or any identity detail.

**One architecture point I want everyone aligned on before we start, especially whoever's writing the contract:** the correct pattern keeps private attributes on the user's own device — proof generation happens via a local proof server, not our backend. That's Midnight's own standard, not something we're inventing. Under time pressure, the tempting shortcut is sending raw attributes to our own server and checking conditions there — it looks identical in a demo, and it is not the same product. I'd rather we name that risk together now than discover it during judging.

**The failure case is part of the product, not an edge case:**
```
Second identity: Active employee, Role Tier 1 (line staff), Catering unit
      ↓
Midnight predicate → FAIL (role_tier < 3)
      ↓
Catering data never released
      ↓
AI cannot answer from it
```
Showing pass and fail side by side is what proves Midnight is load-bearing rather than decorative.

**Mock issuer:** Ember & Oak Hospitality Group signs the synthetic employee credential — the same demonstration company already used across FFC's real case-study materials, so this isn't a one-off fictional entity invented just for the weekend. We're not integrating a real identity system, and we say so plainly in the README — that's honest documentation, not a weakness to hide.

## MVP — What "Done Tonight" Means

1. User selects synthetic identity A or B.
2. Private attributes enter the Midnight proof flow, locally.
3. Compact checks the three conditions.
4. App receives `VERIFIED` or `REJECTED`.
5. `VERIFIED` releases one synthetic confidential document.
6. AI performs one useful task on that document.
7. `REJECTED` provably means the AI never touches it.
8. UI shows the full chain: Private Inputs → Midnight Verification → Disclosed Result → AI Context Released → AI Output.

Everything past this is a stretch goal, attempted only once the above is solid: signed issuer credential → multiple scopes (Catering / Restaurant / Bakery) → human-approval gate for high-risk actions → audit view.

## Suggested Work Split — Open to Reshuffling

| Owns | Task |
|---|---|
| Midnight/Compact proof flow | Application integration, the local-proof-server pattern above |
| Web UI | Before/after visual, the pass/fail flow made visible |
| AI service | Gated document Q&A/summarization |
| Mock issuer | Ember & Oak credential signing, both test identities, the fixtures |
| Me | Architecture, acceptance tests, demo narrative, README, business case |

Happy to draft a short, concrete brief for each piece — what it needs to do, what "done" looks like, what's explicitly not your problem — if that'd help anyone move faster once we lock the idea. Not because anyone needs hand-holding; a clear brief just means less time guessing and more time building, for whoever picks up any of these.

## Against the Actual Judging Criteria

| Criterion | How This Answers It |
|---|---|
| Technology | Real ZK selective disclosure via Compact, using Midnight's actual local-proof-server model |
| Originality | Authorization without identity — sharper than the default "encrypt the chat" framing |
| Execution | Small, sequential, testable — deliberately skipping zkML/private inference, which is what would actually wreck polish under 48 hours |
| Completion | MVP is a fully closed loop — pass, fail, both shown, nothing implicit |
| Documentation | README states plainly this uses a mock issuer and names exactly what "done" means |
| Business Value | AI agents are becoming powerful enough to act across sensitive business systems. Ember & Oak is a stand-in for any real operator with the same problem — the AI learns what it may do, not the private information that made it eligible. Real enterprise problem, not a toy |

## Submission Logistics — Confirmed Against the Official Rules

- Demo video, 2 minutes or less, must open by stating the hackathon name
- Recorded during the event weekend itself, not pre-made
- Public repo, stays public after to keep prize eligibility
- Registration must match across Devpost and MLH's event page

---

Genuinely want the pushback, not just a vote — if someone sees a better idea or a real hole in this one, that's worth more to me right now than getting my pick approved.
