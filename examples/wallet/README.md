# Ciphra — Confidential B2B Payroll & Selective Tax Receipts on Solana

[![Solana Privacy Rings](https://img.shields.io/badge/Solana-Privacy%20Rings-06B6D4?style=flat-square&logo=solana)](https://github.com/helius-labs)
[![Groth16 In-Browser Proving](https://img.shields.io/badge/Prover-Groth16%20WASM%20Multithreaded-10B981?style=flat-square)](https://github.com/helius-labs)
[![Asset Support](https://img.shields.io/badge/Assets-SOL%20%7C%20Confidential%20USDC-F59E0B?style=flat-square)](https://spl.solana.com/token)
[![Cross-Origin Isolation](https://img.shields.io/badge/COOP%2FCOEP-Ready-3B82F6?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy)

**Ciphra** is a payroll app on Solana Privacy Rings (`@heliuslabs/spr`). `buildMultiTransferTransaction` states that its proof hides every amount and recipient. The fee-paying Solana account remains the transaction signer.

---

## 1. Executive Summary

Standard Solana transfers broadcast every payer, recipient, and transfer amount in cleartext. Competitive intelligence bots, AI scrapers, and Solscan scrapers routinely index company treasury accounts to calculate:
1. **Total Monthly OPEX & Runway**: Precise burn rate visible in real time.
2. **Team Salary Hierarchy**: Exact compensation differences between senior engineers, auditors, and executives.
3. **Temporal Payout Clustering**: Predictable monthly or bi-weekly disbursement dates that correlate on-chain addresses directly with specific team members.

Payroll runs call `buildMultiTransferTransaction` (1 to 15 payments). Optional timing jitter spaces chunks. A `ciphra_payroll_journal` record is written before the first send, stores the public blockhash and `lastValidBlockHeight`, and is deleted once every chunk is confirmed. A submitted signature is resent only when `getSignatureStatuses` is empty and the block height has passed `lastValidBlockHeight`. `/verify` decrypts indexed notes: recipient `decryptUtxo` for one paystub, or the sender `transactionViewingKey` and `decryptSlotEphemeral` for a full batch. The recipient `ViewingKey` opens every note encrypted to that key.

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
|   - Local witness generation (witnesses are not sent to the prover URL)           |
|   - buildMultiTransferTransaction: up to 15 payments; shapes pad to 2/4/8/16      |
+-----------------------------------------------------------------------------------+
                                      |
                +---------------------+---------------------+
                v                                           v
+-------------------------------+           +-------------------------------+
|       NATIVE SOL POOL         |           |    CONFIDENTIAL USDC POOL     |
| - 9 Decimals                  |           | - 6 Decimals                  |
| - Program: ring1GaLC...XANW   |           | - Devnet mint default: 4zMMC...DncDU |
| - Encrypted UTXO State Tree   |           | - Mainnet Mint: EPjF...t1v    |
+-------------------------------+           +-------------------------------+
                |                                           |
                +---------------------+---------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------+
|                       SOLANA PRIVACY RINGS ON-CHAIN POOL                          |
|   - Groth16 shielded-pool program used by @heliuslabs/spr                          |
|   - Nullifiers so a spent note cannot be spent again                              |
|   - Shielded keys from LocalKeys.fromDerivationSeed; notes open with a viewing key |
+-----------------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------+
|                     SELECTIVE AUDIT VERIFIER (/verify)                            |
|   - Selective disclosure receipts for tax compliance, CPA audits & proof-of-work  |
|   - 1-Click CPA Spreadsheet (.csv) & Cryptographic Certificate (.json) export     |
+-----------------------------------------------------------------------------------+
```

### 1. Multi-recipient transfers
`runBatchPayroll` splits recipients into chunks of 14 and appends the protocol fee as one more payment, then calls `buildMultiTransferTransaction`.

Installed `@heliuslabs/spr@0.9.0-alpha` types:
- `MultiTransferTransactionParams.payments` is documented as one to fifteen payments.
- `MAX_TRANSFER_PAYMENTS` is the widest `SPP_SUPPORTED_SHAPES` output count minus one. Those shapes use 2, 4, 8, or 16 outputs, so the payment cap is 15. A 15-payment transfer is padded into a 16-output shape, which leaves room for one change output.
- This repository does not ship a separate 15-output circuit.

The local browser prover refuses a proof whose input list is longer than 8 (`MAX_LOCAL_INPUTS`). Wider spends are expected to merge first through the attested prover (`proverTee`).

### 2. Dual-Asset Confidentiality (SOL & USDC)
Ciphra natively supports both Native Solana (`SOL`, 9 decimals) and Confidential SPL Token (`USDC`, 6 decimals):
- Seamless toggle in the Treasury Telemetry strip and Batch Payroll desk.
- Instant 1-click Devnet USDC faucet helper (`actions.mintDevnetTestUsdc`) so testers can mint 10,000 test USDC and shield immediately.

### 3. Anti-Correlation Mode (Staggered Timing Jitter)
Blockchain analytics firms use temporal clustering to correlate batches executed at exact block timestamps. Ciphra's optional Anti-Correlation engine introduces randomized 2s–6s intervals between payout proof sub-batches, reducing timing-pattern correlation that could otherwise reveal recurring payroll schedules. Note: this reduces but does not eliminate all graph analysis correlation.

### 4. Selective Disclosure Tax Receipts (`/verify`) & CPA CSV Export
Privacy does not mean untraceability for legitimate accounting. Ciphra provides institutional audit tooling:
- **Batch Audit Receipts**: Exported `.json` containing tx signatures, block slots, asset mint, an Ed25519 digital signature from the payer (`payerSignature`), and a deterministic **SHA-256 commitment hash** (`receiptCommitmentHash`) over canonical `{ network, programId, payerPubkey, asset, mint, chunks }`.
- **Single-Contractor Selective Receipts**: Allows an employer to prove payment to one specific contractor (for tax or dispute resolution) without unmasking other team members or total treasury reserves. Each receipt includes its own Ed25519 digital attestation and tamper-evident SHA-256 digest.
- **On-Chain Audit Verifier (`/verify`)**: Requires `getTransaction` with `maxSupportedTransactionVersion` and an indexer fetch. Account keys must include the shielded-pool program. There is no `getSignatureStatuses` fallback. Paystub verification calls `ViewingKey.decryptUtxo` and shows only that note. Employer verification calls `transactionViewingKey(firstNullifier)` and `decryptSlotEphemeral` on every slot, and the page warns before that key is used or exported. If a receipt JSON is attached, each payout line must carry a shielded address. Zero decrypted notes are `FAILED` before an empty receipt is considered. A signature with notes but no claimed amounts is not `VERIFIED`. Employer mode matches each decrypted output's recipient viewing key and amount to the receipt line's shielded address. A missing shielded address or an unreadable amount is an unsupported receipt, and an extra or missing pair is `TAMPERED`.
- **1-Click CPA Spreadsheet Export**: Generates an accounting CSV (`Date,Run_ID,Asset,Mint,Contractor_Address,Role_Memo,Disbursed_Amount,Protocol_Fee,Tx_Signature,Block_Slot`).

### 5. What this repository does not claim
This repository does not include an audit report, and it does not claim an OtterSec review, post-quantum encryption, or a fixed error-free build. Merges that exceed the local 8-input limit use the deployment's attested prover client (`proverTee` on `createSprClient`).

---

## 3. Wallet Connection & Demo Architecture

Ciphra supports flexible onboarding tailored for both live production and developer evaluation:

| Wallet Mode | Description | How It Works |
| :--- | :--- | :--- |
| **🟣 Phantom** | Standard Solana browser extension | Connects via `window.phantom.solana`. The wallet signs `ed25519DerivationMessage(publicKey)`. That 64-byte signature is the `derivationSeed` for `LocalKeys.fromDerivationSeed` and stays in memory until disconnect or page hide. |
| **🟠 Solflare** | Solana web & hardware wallet extension | Connects via `window.solflare`. Same derivation message and in-memory seed as Phantom. |
| **⚡ Demo Mode (Funded Devnet Payer)** | Testing when a key is configured | Reads `VITE_FUNDED_KEYPAIR` into memory for devnet. The public address constant is `CochByMjwdvZTWVPK4GqV3po66TmnjLvBxsC3wexTHQ1`. The key is not written to browser storage. |
| **🔄 Ephemeral Burner** | Isolated testing for engineers | `crypto.getRandomValues` creates a 32-byte key in memory. It is dropped on reset, disconnect, or page hide. |

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
Runs `tsc --noEmit` and the Vite production bundle.

---

## 7. License & Credits
- **Architect & Developer**: [Tejanadh](https://github.com/Tejanadh)
- **Protocol Foundation**: Built on **Solana Privacy Rings** by Helius Labs.
- **Protocol dependency**: Solana Privacy Rings, `@heliuslabs/spr`.
- **License**: Apache-2.0 License.
