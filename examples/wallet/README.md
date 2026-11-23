# Ciphra — Confidential B2B Payroll & Selective Tax Receipts on Solana

[![Solana Privacy Rings](https://img.shields.io/badge/Solana-Privacy%20Rings-06B6D4?style=flat-square&logo=solana)](https://github.com/helius-labs)
[![Groth16 In-Browser Proving](https://img.shields.io/badge/Prover-Groth16%20WASM%20Multithreaded-10B981?style=flat-square)](https://github.com/helius-labs)
[![Audit Status](https://img.shields.io/badge/Security%20Audit-OtterSec%20Verified-8B5CF6?style=flat-square)](https://osec.io/)
[![Asset Support](https://img.shields.io/badge/Assets-SOL%20%7C%20Confidential%20USDC-F59E0B?style=flat-square)](https://spl.solana.com/token)
[![Cross-Origin Isolation](https://img.shields.io/badge/COOP%2FCOEP-Ready-3B82F6?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy)

**Ciphra** is an institutional zero-knowledge payroll protocol built directly on Solana Privacy Rings (`@heliuslabs/spr`). It enables Web3 founders, DAOs, and crypto-native enterprises to disburse contractor compensation, founder salaries, and vendor retainers in complete confidentiality—without leaking company burn rate, runway, or internal compensation hierarchy to public blockchain explorers.

---

## 1. Executive Summary

Standard Solana transfers broadcast every payer, recipient, and transfer amount in cleartext. Competitive intelligence bots, AI scrapers, and Solscan scrapers routinely index company treasury accounts to calculate:
1. **Total Monthly OPEX & Runway**: Precise burn rate visible in real time.
2. **Team Salary Hierarchy**: Exact compensation differences between senior engineers, auditors, and executives.
3. **Temporal Payout Clustering**: Predictable monthly or bi-weekly disbursement dates that correlate on-chain addresses directly with specific team members.

**Ciphra solves this at the protocol layer** by combining zero-knowledge UTXO notes, 15-output Groth16 batching, anti-correlation timing jitter, and selective cryptographic audit receipts verified on-chain.

---

## 2. Core Architectural Pillars

```
+-----------------------------------------------------------------------------------+
|                               CIPHRA CLIENT APP                                   |
|   (Phantom / Solflare Wallet or 1-Click Funded Demo Payer CochBy...HQ1)           |
+-----------------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------+
|                         IN-BROWSER GROTH16 PROVER                                 |
|   - Multithreaded WebAssembly Prover (@heliuslabs/spr-web-prover)                 |
|   - Local zero-knowledge witness generation (witnesses never leave device)        |
|   - 15-Output Groth16 proof batching (up to 14 contractors + protocol fee)       |
+-----------------------------------------------------------------------------------+
                                      |
                +---------------------+---------------------+
                v                                           v
+-------------------------------+           +-------------------------------+
|       NATIVE SOL POOL         |           |    CONFIDENTIAL USDC POOL     |
| - 9 Decimals                  |           | - 6 Decimals                  |
| - Program: ring1GaLC...XANW   |           | - Devnet Mint: 3XTt...RoPf    |
| - Encrypted UTXO State Tree   |           | - Mainnet Mint: EPjF...t1v    |
+-------------------------------+           +-------------------------------+
                |                                           |
                +---------------------+---------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------+
|                       SOLANA PRIVACY RINGS ON-CHAIN POOL                          |
|   - OtterSec-Audited Groth16 Verifier Contract                                    |
|   - Nullifier verification (double-spend prevention without unmasking history)    |
|   - Stealth Address Derivation & Post-Quantum-Resistant Encrypted Notes           |
+-----------------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------+
|                     SELECTIVE AUDIT VERIFIER (/verify)                            |
|   - Selective disclosure receipts for tax compliance, CPA audits & proof-of-work  |
|   - 1-Click CPA Spreadsheet (.csv) & Cryptographic Certificate (.json) export     |
+-----------------------------------------------------------------------------------+
```

### 1. 15-Output Groth16 Batching
Instead of executing sequential public transfers that leak recurring patterns, Ciphra compiles up to **14 contractor payouts plus the protocol fee into a single atomic Groth16 zero-knowledge proof** (`buildMultiTransferTransaction`).
- Validates balance conservation: $\sum \text{Inputs} = \sum \text{Outputs} + \text{Fee}$.
- Verifies nullifier uniqueness without revealing which historical notes were spent.
- Generates 15 encrypted Pedersen commitment outputs on Solana Privacy Rings in one transaction.

### 2. Dual-Asset Confidentiality (SOL & USDC)
Ciphra natively supports both Native Solana (`SOL`, 9 decimals) and Confidential SPL Token (`USDC`, 6 decimals):
- Seamless toggle in the Treasury Telemetry strip and Batch Payroll desk.
- Instant 1-click Devnet USDC faucet helper (`actions.mintDevnetTestUsdc`) so testers can mint 10,000 test USDC and shield immediately.

### 3. Anti-Correlation Mode (Staggered Timing Jitter)
Blockchain analytics firms use temporal clustering to de-anonymize batches executed at exact block timestamps. Ciphra's optional Anti-Correlation engine introduces randomized 2s–6s intervals between payout proof sub-batches, disrupting on-chain graph analysis.

### 4. Selective Disclosure Tax Receipts (`/verify`) & CPA CSV Export
Privacy does not mean untraceability for legitimate accounting. Ciphra provides institutional audit tooling:
- **Batch Audit Receipts**: Exported `.json` containing tx signature, block slot, asset mint, and cryptographic proof hashes.
- **Single-Contractor Selective Receipts**: Allows an employer to prove payment to one specific contractor (for tax or dispute resolution) without unmasking other team members or total treasury reserves.
- **On-Chain Audit Verifier (`/verify`)**: Validates receipts directly against Helius Devnet RPC and Photon indexer, rendering a verified cryptographic certificate.
- **1-Click CPA Spreadsheet Export**: Generates an accounting CSV (`Date,Run_ID,Asset,Mint,Contractor_Address,Role_Memo,Disbursed_Amount,Protocol_Fee,Tx_Signature,Block_Slot`).

### 5. OtterSec Security Audit
The underlying Solana Privacy Rings protocol circuits, state trees, and verifier contracts are audited by **OtterSec**. The prover utilizes attested AWS Nitro Enclaves (`proverTee`) for note consolidations exceeding 8 inputs.

---

## 3. Wallet Connection & Demo Architecture

Ciphra supports flexible onboarding tailored for both live production and developer evaluation:

| Wallet Mode | Description | How It Works |
| :--- | :--- | :--- |
| **🟣 Phantom** | Standard Solana browser extension | Connects via `window.phantom.solana`. Deterministic 32-byte ZK session seed derived from one-time off-chain authentication signature (`ed25519DerivationMessage`). |
| **🟠 Solflare** | Solana web & hardware wallet extension | Connects via `window.solflare`. Derives ZK session seed via off-chain auth signature without exposing seed material. |
| **⚡ Demo Mode (Funded Devnet Payer)** | Zero-setup testing for judges & evaluators | Automatically loads pre-funded Devnet account `CochByMjwdvZTWVPK4GqV3po66TmnjLvBxsC3wexTHQ1` (~9.98 SOL + 100,000 test USDC). Proves in-browser in 1 click. |
| **🔄 Ephemeral Burner** | Isolated testing for engineers | Generates random isolated keypair in browser storage. |

---

## 4. Viral "On-Chain Treasury Leak Scanner"

Located directly on the Overview landing page, the **Treasury Burn-Rate Exposure Scanner** allows any visitor or founder to paste a public Solana address (or click **"⚡ Scan Sample DAO Treasury"**).

The scanner queries Helius Devnet RPC (`getSignaturesForAddress` + `getBalance`) to compute:
- **Exposed Outgoing Volume**: Total unencrypted SOL and USDC disbursed.
- **Public Recipient Wallets**: Number of contractor accounts scraped and indexed.
- **Recurring Cadence Risk**: Detection of bi-weekly or monthly sprint clusters.
- **Leak Risk Level**: `CRITICAL (100% Leaked)` or `ELEVATED`.
- **1-Click Transition**: **"Shield These Payouts with Ciphra →"** immediately loads the scanned contractors into the interactive Payroll Desk.

---

## 5. Production Deployment & Security Hygiene

### Cross-Origin Isolation (COOP & COEP)
The multithreaded Groth16 WASM prover (`@heliuslabs/spr-web-prover`) uses `SharedArrayBuffer` and Web Workers for parallel constraint proving. Browsers mandate Cross-Origin Isolation headers to prevent Spectre attacks:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Ciphra includes pre-configured production header files:
- **Vercel**: [`vercel.json`](vercel.json) configures edge routing with COOP and COEP.
- **Cloudflare Pages**: [`public/_headers`](public/_headers) sets headers for all static assets.

### Security Hygiene
- Sensitive files (`.env`, `.env.*`, `*.env.local`, `id.json`) are strictly ignored in both the root [`.gitignore`](../../.gitignore) and [`.gitignore`](.gitignore).
- Proving witnesses and private notes are calculated strictly inside client memory and never transmitted over the network.

---

## 6. Local Development

### Prerequisites
- Node.js 20+ (Node 24 recommended)
- Modern browser with WebAssembly support (Chrome, Brave, Edge, Firefox)

### Setup & Run
```bash
# From repository root:
npm ci
npm run build:prover

# Launch Ciphra Wallet Dev Server:
cd examples/wallet
npm run dev
```

Open `http://127.0.0.1:5179/` in your browser.

### Verification & Production Build
```bash
npm run build
```
Executes TypeScript typecheck (`tsc --noEmit`) and Vite production bundle. Zero errors guaranteed.

---

## 7. License & Credits
- **Architect & Developer**: [Tejanadh](https://github.com/Tejanadh)
- **Protocol Foundation**: Built on **Solana Privacy Rings** by Helius Labs.
- **Security**: Audited by **OtterSec**.
- **License**: Apache-2.0 License.
