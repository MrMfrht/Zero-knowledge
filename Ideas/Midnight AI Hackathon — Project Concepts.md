
## 1. AI Black Box Auditor

### Working Name
**BlackBox**

### Tagline
> **Prove your AI is safe without revealing how it works.**

---

## Problem

AI models are increasingly being used for high-impact decisions such as:

- Hiring
- Loan approval
- Insurance
- Healthcare
- Content moderation
- Fraud detection
- Risk assessment

Companies may claim that their AI is:

- Fair
- Accurate
- Safe
- Non-discriminatory
- Compliant

But external auditors generally need access to sensitive information such as:

- Proprietary model weights
- Private datasets
- Customer data
- Internal evaluation datasets
- Business logic

This creates a fundamental trust problem.

### The Question

**How can a company prove that its AI satisfies certain requirements without exposing the AI model or its private data?**

---

# Solution

**BlackBox** is a privacy-preserving AI auditing platform.

A company submits its AI model and a private evaluation dataset.

The AI auditor evaluates the model against predefined requirements.

For example:

```text
Accuracy ≥ 90%
Bias score ≤ threshold
False-positive rate ≤ threshold
Safety score ≥ threshold
```

Instead of publishing the model, dataset, or detailed evaluation results, BlackBox generates a **verifiable proof** that the model satisfied the required conditions.

The proof is verified through **Midnight**.

---

# How It Works

```text
              PRIVATE ENVIRONMENT
                     │
          ┌──────────▼──────────┐
          │     AI MODEL        │
          └──────────┬──────────┘
                     │
                     │
          ┌──────────▼──────────┐
          │ PRIVATE TEST DATA   │
          └──────────┬──────────┘
                     │
                     ▼
             AI AUDIT ENGINE
                     │
          ┌──────────┴──────────┐
          │                     │
      Accuracy               Fairness
          │                     │
      Safety                 Robustness
          │                     │
          └──────────┬──────────┘
                     ▼
             AUDIT RESULT
                     │
                     ▼
             ZK PROOF GENERATION
                     │
                     ▼
                MIDNIGHT
                     │
                     ▼
             PUBLIC VERIFIER
```

---

# Example

A company operates an AI hiring system.

The company claims:

> "Our model has at least 90% accuracy and does not exceed the permitted bias threshold."

Instead of giving auditors the model and candidate data:

```text
Model weights          🔒
Training data          🔒
Candidate data         🔒
Company logic          🔒
```

BlackBox generates a proof.

The verifier sees:

```text
AI AUDIT REPORT

Model ID: BB-20491

Accuracy requirement       ✓ PASSED
Fairness requirement       ✓ PASSED
Safety requirement         ✓ PASSED
Evaluation integrity       ✓ VERIFIED

Underlying model           🔒 PRIVATE
Evaluation dataset         🔒 PRIVATE

MIDNIGHT VERIFICATION
Status: VALID
```

---

# AI Component

The AI layer performs the actual auditing.

Possible modules:

### 1. Accuracy Auditor

Evaluates:

- Accuracy
- Precision
- Recall
- F1 score
- ROC-AUC

### 2. Bias Auditor

Evaluates:

- Demographic parity
- Equal opportunity
- False-positive disparity
- False-negative disparity

### 3. Safety Auditor

Tests the model against:

- Unsafe outputs
- Prompt attacks
- Toxicity
- Hallucination
- Adversarial inputs

### 4. Explainability Layer

AI generates a human-readable explanation of why the model passed or failed.

---

# Midnight Component

Midnight is responsible for the **verification layer**.

The blockchain does NOT need to store:

- The AI model
- The private dataset
- User information
- Sensitive evaluation results

Instead, Midnight can verify the required conditions.

Conceptually:

```text
Private Inputs

Model
Dataset
Evaluation Results

        ↓

Private Computation

        ↓

ZK Proof

        ↓

Midnight

        ↓

"Requirements were satisfied"
```

---

# Key Innovation

Traditional AI auditing asks:

> **"Show me your model and your data."**

BlackBox asks:

> **"Prove that your model satisfies the requirements."**

This changes AI auditing from **trust-based disclosure** to **cryptographically verifiable compliance**.

---

# Potential Applications

### Hiring AI

Prove fairness without exposing candidate information.

### Banking AI

Prove a credit model satisfies regulatory requirements.

### Healthcare AI

Prove diagnostic models meet performance requirements without exposing patient records.

### Insurance

Prove risk models satisfy fairness requirements.

### Autonomous Systems

Prove safety tests were successfully completed.

### Government AI

Prove AI systems satisfy predefined compliance rules.

---

# MVP for Hackathon

A realistic hackathon MVP could focus on **AI hiring bias auditing**.

### User Flow

1. Upload an AI model.
2. Upload a private evaluation dataset.
3. Select audit requirements.
4. Run AI audit.
5. Display audit results.
6. Generate proof.
7. Submit proof to Midnight.
8. Third party verifies the result.

### Example Requirements

```text
Accuracy ≥ 90%

Demographic parity difference ≤ 0.10

False-positive-rate difference ≤ 0.10

Safety score ≥ 90%
```

---

# Tech Stack

### Frontend

- Next.js
- React
- Tailwind CSS

### Backend

- Python
- FastAPI

### AI

- PyTorch
- Scikit-learn
- Hugging Face
- LLM for audit explanations

### Privacy / Blockchain

- Midnight
- Compact smart contracts
- Zero-knowledge proofs

### Database

- PostgreSQL

---

# Why Midnight?

Without Midnight, BlackBox could simply generate an audit report.

The problem is:

**Who should trust the report?**

The company could potentially manipulate it.

Midnight introduces a verifiable trust layer.

The auditor doesn't need to blindly trust:

> "Our AI passed."

They can verify:

> **"The required conditions were actually satisfied."**

---

# Future Vision

BlackBox could evolve into an **AI Certification Network**.

Companies could receive verifiable certifications such as:

```text
✓ Fair AI
✓ Safe AI
✓ Privacy Compliant
✓ Accuracy Verified
✓ Regulatory Requirements Met
```

These certifications could be verified by:

- Customers
- Regulators
- Enterprises
- Developers
- Platforms

---

# 2. AI Bounty Hunter

### Working Name

**Bounty Hunter**

### Tagline

> **Find the truth without exposing the evidence.**

---

# Problem

Organizations and individuals often need to investigate claims involving sensitive information.

Examples:

- Corporate fraud
- Financial manipulation
- Data breaches
- Fake documents
- Research misconduct
- Insider threats
- Regulatory violations
- Misinformation

Investigators may possess sensitive evidence but cannot simply publish it.

The evidence could contain:

- Personal information
- Confidential documents
- Trade secrets
- Private communications
- Whistleblower identities

At the same time, simply saying:

> "We have evidence."

is not enough.

There is a trust problem.

---

# Solution

**AI Bounty Hunter** is a privacy-preserving investigation platform.

Users submit a claim and private evidence.

AI analyzes the evidence and determines whether it supports the claim.

The system then generates a verifiable proof that:

> **The submitted evidence satisfied the predefined verification criteria.**

The sensitive evidence remains private.

---

# Core Concept

```text
                  CLAIM
                    │
                    ▼
             ┌─────────────┐
             │  AI AGENT   │
             └──────┬──────┘
                    │
                    ▼
             PRIVATE EVIDENCE
                    │
                    ▼
             EVIDENCE ANALYSIS
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
      Sources    Entities    Claims
         │          │          │
         └──────────┼──────────┘
                    ▼
             CONFIDENCE SCORE
                    │
                    ▼
             VERIFICATION RULES
                    │
                    ▼
                ZK PROOF
                    │
                    ▼
                MIDNIGHT
                    │
                    ▼
             VERIFIABLE CLAIM
```

---

# Example

### Claim

> "Company X violated its internal procurement policy."

The investigator possesses:

```text
Private emails
Private invoices
Internal documents
Transaction records
```

The AI analyzes the evidence.

It determines:

```text
Evidence sources              17

Relevant documents             9

Policy violations              3

Independent evidence chains    2

Confidence                    94%
```

Instead of publishing the documents:

```text
Private evidence       🔒
Whistleblower identity 🔒
Company information   🔒
```

The investigator publishes:

```text
CLAIM VERIFIED

Claim:
Procurement policy violation detected.

Evidence threshold:     80%
AI confidence:          94%
Independent evidence:   2

Midnight Proof:
VALID ✓
```

A verifier can check the proof without receiving the underlying evidence.

---

# AI Component

The AI acts as an **evidence investigator**.

### 1. Evidence Extraction

Extract:

- People
- Organizations
- Dates
- Transactions
- Locations
- Events
- Claims

### 2. Relationship Detection

Build connections between evidence.

Example:

```text
Invoice #1829
      │
      ▼
Company A
      │
      ▼
Employee B
      │
      ▼
Transaction X
      │
      ▼
Policy violation
```

### 3. Contradiction Detection

AI identifies conflicting statements.

Example:

```text
Document A:
Transaction occurred on March 10.

Document B:
Transaction supposedly occurred on March 15.

⚠ Potential contradiction
```

### 4. Evidence Scoring

AI evaluates:

- Relevance
- Consistency
- Source diversity
- Evidence strength
- Contradictions

---

# The Bounty System

This is where the project becomes more interesting.

Organizations can create investigation bounties.

Example:

```text
BOUNTY #0192

Target:
Verify whether a procurement violation occurred.

Reward:
500 DUST

Required evidence:
≥ 3 independent sources

Minimum confidence:
90%

Privacy:
Required
```

Investigators can submit evidence privately.

If their proof satisfies the bounty requirements:

```text
✓ Evidence accepted

✓ Proof verified

✓ Bounty completed

Reward released
```

---

# Why Use Midnight?

The core problem is that **evidence itself is sensitive**.

Traditional systems require:

> Upload evidence → Store evidence → Trust administrator.

Bounty Hunter changes that to:

> Analyze privately → Generate proof → Verify claim.

Midnight becomes the **trustless verification layer**.

---

# Privacy Model

The platform should follow:

### Principle

> **Reveal the conclusion, not the evidence.**

For example:

Instead of:

```text
Here are 17 confidential documents.
```

Reveal:

```text
17 pieces of evidence were analyzed.

9 were relevant.

3 independently support the claim.

Confidence threshold was exceeded.

Proof: VALID
```

---

# Potential Applications

### 🕵️ Whistleblowing

Protect whistleblowers while validating claims.

### 💰 Fraud Detection

Verify suspicious financial activity.

### 📰 Journalism

Protect confidential sources.

### 🔬 Scientific Research

Verify research claims without exposing unpublished datasets.

### 🛡️ Cybersecurity

Prove a security incident occurred without exposing infrastructure details.

### 🏢 Corporate Compliance

Verify internal policy violations.

### 🌐 Misinformation Investigation

Evaluate claims using private evidence.

---

# MVP for Hackathon

Don't attempt to build a complete investigative platform.

Build a focused demo:

## "Private Fraud Investigation"

### Flow

1. User creates a claim.
2. User uploads 3–5 pieces of evidence.
3. AI analyzes the documents.
4. AI extracts relevant facts.
5. AI builds an evidence graph.
6. AI calculates confidence.
7. User selects disclosure level.
8. ZK proof is generated.
9. Proof is verified through Midnight.
10. A public verification page is created.

---

# Example UI

```text
┌─────────────────────────────────────┐
│          BOUNTY HUNTER              │
├─────────────────────────────────────┤
│                                     │
│ Claim                               │
│ ┌─────────────────────────────────┐ │
│ │ Procurement fraud detected     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Evidence                            │
│                                     │
│ ✓ invoice_1829.pdf                 │
│ ✓ email_thread.pdf                 │
│ ✓ transaction.csv                  │
│ ✓ internal_policy.pdf              │
│                                     │
│        [ RUN AI INVESTIGATION ]     │
│                                     │
└─────────────────────────────────────┘
```

Result:

```text
INVESTIGATION COMPLETE

Evidence analyzed          4
Relevant evidence          3
Independent sources        2

AI confidence             94%

Required threshold        90%

STATUS                    ✓ VERIFIED

Evidence                   🔒 PRIVATE
Identity                   🔒 PRIVATE

MIDNIGHT PROOF             VALID
```

---

# Tech Stack

### Frontend

- Next.js
- React
- Tailwind CSS

### Backend

- FastAPI
- Python

### AI

- LLM
- LangGraph
- PyMuPDF
- OCR
- Embedding model
- Vector database

### Evidence Analysis

- RAG
- Entity extraction
- Document classification
- Evidence graph

### Blockchain / Privacy

- Midnight
- Compact
- Zero-knowledge proofs

### Database

- PostgreSQL
- ChromaDB / FAISS

---

# BlackBox vs AI Bounty Hunter

| | BlackBox | AI Bounty Hunter |
|---|---|---|
| Core problem | AI trust | Evidence trust |
| AI role | Audit AI models | Investigate evidence |
| Private asset | Model + dataset | Evidence + identity |
| Midnight role | Verify AI compliance | Verify investigation claims |
| Main user | Companies / auditors | Investigators / journalists |
| Demo complexity | Medium | Medium–High |
| Novelty | Very High | Very High |
| Storytelling | Strong | Extremely strong |
| Privacy necessity | Very High | Extremely High |
| Hackathon potential | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

# Strategic Difference

## BlackBox

The question is:

> **"Can you prove your AI is trustworthy?"**

## AI Bounty Hunter

The question is:

> **"Can you prove your evidence is sufficient without exposing it?"**

Both projects use the same fundamental Midnight philosophy:

```text
PRIVATE DATA
     ↓
AI COMPUTATION
     ↓
VERIFIABLE RESULT
     ↓
ZERO-KNOWLEDGE PROOF
     ↓
MIDNIGHT
     ↓
PUBLIC TRUST
```

The key principle is:

> **Don't put private data on the blockchain. Put proof on the blockchain.**