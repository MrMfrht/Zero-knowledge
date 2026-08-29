# BlindBid — Closed Private Auction on Midnight

## 1. Project Overview

**BlindBid** is a privacy-first, sealed-bid auction application built on the Midnight Network.

> **Bid privately. Win fairly.**

Users submit hidden bids. When the auction closes, the system verifies valid bids, determines the winner, settles the winner's deposit to the seller, and refunds losing deposits.

### One-shot lifecycle

```text
OPEN → BID → CLOSE → SETTLE → FINISHED
```

This is the easiest version of the private-auction idea because there is no lease, recurring payment, or tenant-management system.

---

## 2. Practical Example

A seller auctions a MacBook.

- Starting bid: ₹40,000
- Duration: 5 minutes

```text
Bidder A → 🔒 ₹45,000
Bidder B → 🔒 ₹50,000
Bidder C → 🔒 ₹47,000
```

During the auction, users only see:

```text
🔒 3 Private Bids
```

After closing:

```text
🏆 Winner: Bidder B
Winning bid: ₹50,000
```

Settlement:

```text
Winner's deposit → Seller
Loser's deposits  → Refunded
```

---

## 3. Why Midnight?

Midnight is designed for privacy-preserving applications using confidential data, zero-knowledge proofs, and selective disclosure.

For BlindBid, the sensitive information is the **bid**.

```text
User
  ↓
Private Bid
  ↓
Midnight
  ↓
Verify Auction Rules
  ↓
Auction Closes
  ↓
🏆 Winner
```

**Hackathon message:**

> Midnight allows us to keep sensitive bid information private while still proving that the auction rules were followed.

Official docs: https://docs.midnight.network/

---

## 4. MVP Features

### 1. Create Auction

Seller enters:

- Item name
- Description
- Starting bid
- Auction duration

### 2. View Auction

```text
💻 MacBook Air M2

Starting Bid: ₹40,000
⏱️ 03:42 remaining
🔒 3 Private Bids

Your Bid:
₹ __________

[ SUBMIT PRIVATE BID ]
```

### 3. Private Bid

Check:

- Auction is still open
- Bid meets the minimum
- Bidder follows auction rules
- Bid/deposit is recorded according to the contract

User sees:

> ✅ Private bid submitted

Other bidders do not see the amount.

### 4. Close Auction

When the timer reaches zero:

```text
⏰ AUCTION CLOSED
```

New bids are rejected.

### 5. Settlement

Example:

```text
Bidder A → ₹45,000
Bidder B → ₹50,000 🏆
Bidder C → ₹47,000
```

```text
₹50,000 → Seller
₹45,000 → Bidder A refund
₹47,000 → Bidder C refund
```

---

## 5. Smart Contract Logic

Suggested operations:

```text
createAuction()
placeBid()
closeAuction()
settleAuction()
claimRefund()
```

### createAuction()

Stores:

```text
auctionId
item
startingPrice
seller
endTime
status
```

### placeBid()

Checks:

```text
auction is open
+
bid meets minimum
+
bidder follows rules
```

Then records/locks the bid according to the privacy and escrow design.

### closeAuction()

```text
OPEN → CLOSED
```

No more bids are accepted.

### settleAuction()

Determines the highest valid bid and winner, then performs settlement.

### claimRefund()

Allows losing bidders to receive their refundable deposit.

---

## 6. User Flow

```text
                 HOME
                   ↓
            CREATE AUCTION
                   ↓
             AUCTION PAGE
              ↙         ↘
          BIDDER        SELLER
             ↓             ↓
       Private Bid      Monitor
             ↓             ↓
          🔒 BID           ⏳
              ↘           ↙
               AUCTION CLOSES
                     ↓
             VERIFY PRIVATE BIDS
                     ↓
                🏆 WINNER
                     ↓
                 SETTLE
                ↙       ↘
           Winner      Losers
              ↓           ↓
           Seller      Refund
```

---

## 7. Recommended Technology Stack

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS

### Midnight

- Midnight Compact smart contracts
- Midnight.js / current Midnight SDK
- Midnight testnet
- Lace Wallet
- Midnight proof server

### Development

- VS Code
- Git
- GitHub
- Node.js
- Docker

---

## 8. Free / Low-Cost Tools

| Tool | Purpose | Cost |
|---|---|---|
| VS Code | Coding | Free |
| Git | Version control | Free |
| GitHub | Repository / collaboration | Free tier |
| Node.js | JavaScript runtime | Free |
| React | Frontend | Free / Open source |
| Vite | Frontend tooling | Free / Open source |
| TypeScript | Programming | Free / Open source |
| Tailwind CSS | UI styling | Free / Open source |
| Docker | Local proof server / development | Free for eligible use |
| Midnight Compact | Smart contracts | Developer tooling |
| Midnight SDK | Midnight development | Developer tooling |
| Lace Wallet | Midnight wallet | Free |
| Midnight Testnet | Testing | Use hackathon-supported network |
| Figma | UI planning | Free tier |
| Canva | Presentation | Free tier |

**Note:** Testnet tokens/network services can have specific rules or limits. Follow the current hackathon instructions and Midnight documentation.

---

## 9. Best Midnight Starting Resources

### Official Midnight Documentation

https://docs.midnight.network/

Use it for architecture, Compact, ZK proofs, private state, DApp development, and testnet setup.

### Midnight Wallet DApp Starter

https://github.com/midnightntwrk/midnight-wallet-dapp

Useful because it demonstrates React + Vite, Lace Wallet, Compact contracts, MidnightJS, token operations, and private state storage.

### Midnight Bulletin Board Example

https://github.com/midnightntwrk/example-bboard

Useful as a template containing a Compact contract, API/CLI, and React UI.

### Midnight Counter Example

https://github.com/midnightntwrk/example-counter/

Useful for learning the basic contract/deployment flow before modifying it for BlindBid.

---

## 10. Development Steps

### Phase 1 — Learn Midnight

Start with the official Counter or Bulletin Board example.

```text
Run example
   ↓
Connect wallet
   ↓
Deploy/interact
   ↓
Understand Compact
```

### Phase 2 — Build BlindBid Contract

Implement:

```text
createAuction
placeBid
closeAuction
settleAuction
refund
```

### Phase 3 — Build UI

Create only:

```text
Home
Create Auction
Auction
Result
```

### Phase 4 — Connect

```text
React UI
   ↓
Midnight.js
   ↓
Lace Wallet
   ↓
Midnight
```

### Phase 5 — Test

Test:

- Valid bid
- Bid below minimum
- Bid after deadline
- Multiple bidders
- Auction closing
- Winner selection
- Loser refund
- Settlement

### Phase 6 — Polish

Add:

- Countdown timer
- Private-bid indicator
- Auction status
- Winner screen
- Transaction/status messages
- Simple Midnight privacy explanation

---

## 11. Hackathon Demo

Aim for 3–5 minutes.

1. Seller creates: **MacBook Air — starting bid ₹40,000**
2. Bidder A submits ₹45,000.
3. Bidder B submits ₹50,000.
4. Show: **2 Private Bids**
5. Close auction.
6. Show: **Winner + winning bid**
7. Show settlement: **Winner → Seller, Loser → Refund**
8. Explain Midnight privacy.

Suggested explanation:

> The key difference is that bidders do not need to reveal their bids to competitors. Midnight provides the privacy and verification layer for the sensitive auction information.

---

## 12. Track Fit

### Best Track: Integrate Midnight

To fit this track strongly, demonstrate a clear **before vs after**.

### Before

```text
Traditional Auction
       ↓
Public Bid
       ↓
Everyone sees the bid
```

### After

```text
Existing Auction Experience
       ↓
+ Midnight
       ↓
🔒 Private Bid
       ↓
Verified Auction
       ↓
🏆 Fair Settlement
```

If you create a completely new auction app rather than integrating privacy into an existing app, check the hackathon rules carefully because the Integrate track specifically asks for an existing app plus Midnight.

---

## 13. MVP vs Optional Features

### MUST HAVE

- Create auction
- Private bid
- Auction deadline
- Close auction
- Winner determination
- Settlement/refund
- Midnight integration

### NICE TO HAVE

- Multiple auctions
- Bid history for the bidder
- QR/shareable auction link
- Notifications
- Seller dashboard
- Auction analytics

### DO NOT BUILD FIRST

- Full marketplace
- Chat
- Reviews
- Complex profiles
- AI
- Mobile app
- Recurring payments
- Rental/lease system

Get the core auction working first.

---

## 14. Final Pitch

> **BlindBid is a privacy-first sealed-bid auction. Bidders lock their bids without exposing them to competitors. When the auction closes, Midnight helps verify the auction rules and determine the valid winner. The winner's deposit is settled to the seller, while losing deposits are refunded.**

### Tagline

> **BlindBid — Bid privately. Win fairly.**

---

## 15. Build Priority

```text
                🔥 CORE
                  │
          Private Bidding
                  ↓
           Auction Closing
                  ↓
          Winner Selection
                  ↓
             Settlement
                  │
                Midnight
                  │
        ──────────┼──────────
        ↓         ↓          ↓
      UI      Wallet      Testnet
        │         │          │
        └─────────┴──────────┘
                  ↓
             DEMO READY
```

**Important:** Start from an official Midnight example instead of writing the blockchain layer from scratch. The official examples provide Compact contracts, proof-server/testnet workflows, and UI/CLI patterns that can save substantial hackathon time.
