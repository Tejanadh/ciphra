import { useCallback, useEffect, useRef, useState } from "react";
import { formatAmount, parseAmount } from "@heliuslabs/spr";
import { getAssociatedTokenAddress } from "@heliuslabs/spr/addresses";
import { address, isAddress } from "@solana/kit";
import {
  JUPITER_USDC_MINT,
  RELAYER_UNAVAILABLE_NOTICE,
  WSOL_MINT,
  clampStealthSwapAmount,
  createEphemeralBurner,
  executeStealthBurnerSwap,
  fetchRelayerStatus,
  liveJupiterEnabled,
  quoteLiveJupiterSwap,
  quoteStealthBurnerSwapStub,
  stealthUnshieldCap,
  wipeEphemeralBurner,
  type EphemeralBurner,
  type StealthSwapQuote,
} from "./stealthBurners.js";
import { shapeByLabel, type KeyProgress, type Measurement } from "@heliuslabs/spr-web-prover";

import {
  connectBrowserWallet,
  disconnectBrowserWallet,
  getActiveWalletInfo,
  hasFundedDevnetPayer,
  loadFundedDevnetSeed,
  resetBurner,
  sessionUnlock,
  FUNDED_PAYER_ADDRESS,
  type ConnectedWalletInfo,
  type WalletType,
} from "./burner.js";
import {
  scanWalletExposure,
  type ExposureScanResult,
  SAMPLE_DAO_TREASURY,
} from "./scanner.js";
import {
  ASSETS,
  DEFAULT_PROTOCOL_FEE_BPS,
  DEVNET_USDC_MINT,
  SOL_MINT,
  USDC_MINT,
  actions,
  attachCommitmentHashes,
  computeSingleReceiptHash,
  createSingleContractorReceipt,
  endpoints,
  network,
  networkLabel,
  openSession,
  exportBatchTransactionViewingKey,
  parseViewingKeyBytes,
  PERSIST_PAYROLL_HISTORY_KEY,
  RECENT_PAYROLL_RUNS_KEY,
  resolveProtocolFeeCollector,
  runBatchPayroll,
  sweepBurnerToShield,
  wipeLocalPayrollHistory,
  snapshot,
  verifyAuditReceipt,
  type VerifyAuditMode,
  type AssetSymbol,
  type BatchPayrollReport,
  type ExecutionResult,
  type PayrollPayoutRecord,
  type PayrollRecipientInput,
  type PrivateTransaction,
  type Session,
  type Snapshot,
  type VerificationResult,
} from "./zolana.js";

interface Activity {
  readonly id: number;
  readonly label: string;
  status: "running" | "done" | "failed";
  detail?: string;
  proofs: { ms: number; note?: string }[];
}

// Clean numerical formatter avoiding float imprecision
const formatSol = (n: number) => {
  return parseFloat(n.toFixed(6)).toString();
};

const sol = (lamports: bigint) => `${formatAmount(lamports, 9)} SOL`;

// 3 Registered Privacy Rings Devnet Accounts - Native SOL sample
const SAMPLE_CONTRACTORS_SOL: PayrollRecipientInput[] = [
  {
    recipient: "B5BQmVv7tjCBaHm8TwLdgY5jKxXpU14gptEspTouKgro",
    amountSol: 0.001,
    amount: 0.001,
    memo: "Lead Rust Engineer — Sprint 42",
  },
  {
    recipient: "B9NFbnL3DV1DVvC89t1G5gcmzZ9e4g2dqN4VwcdwvnxR",
    amountSol: 0.0015,
    amount: 0.0015,
    memo: "ZK Prover & Circuits Lead",
  },
  {
    recipient: "2du3Xtpg1mPJhb6FsfvbXp4VcB78J1qPyyZQyFvb4Ygv",
    amountSol: 0.002,
    amount: 0.002,
    memo: "Smart Contract Security Auditor",
  },
];

// 3 Registered Privacy Rings Devnet Accounts - Confidential USDC sample
const SAMPLE_CONTRACTORS_USDC: PayrollRecipientInput[] = [
  {
    recipient: "B5BQmVv7tjCBaHm8TwLdgY5jKxXpU14gptEspTouKgro",
    amountSol: 4500,
    amount: 4500,
    memo: "Lead Rust Engineer — Monthly Retainer",
  },
  {
    recipient: "B9NFbnL3DV1DVvC89t1G5gcmzZ9e4g2dqN4VwcdwvnxR",
    amountSol: 6000,
    amount: 6000,
    memo: "ZK Prover & Circuits Lead — Monthly Retainer",
  },
  {
    recipient: "2du3Xtpg1mPJhb6FsfvbXp4VcB78J1qPyyZQyFvb4Ygv",
    amountSol: 7500,
    amount: 7500,
    memo: "Smart Contract Security Auditor — Retainer",
  },
];

const SAMPLE_CONTRACTORS: PayrollRecipientInput[] = SAMPLE_CONTRACTORS_SOL;

const SAMPLE_AUDIT_RECEIPT = {
  protocol: "Ciphra",
  version: "1.0",
  network: "Devnet-e",
  asset: "SOL",
  mint: "11111111111111111111111111111111",
  decimals: 9,
  runId: "ciphra-demo-sprint-42",
  formattedDate: "2026-11-22T20:30:00.000Z",
  payerPubkey: "CochByMjwdvZTWVPK4GqV3po66TmnjLvBxsC3wexTHQ1",
  payerSignature: "5wcPwg1iUzp9ZgvtjmCcqMWHJ8qqtFrPr4AfeivhgUc7fztKhoo9UasafhJC62eMHs35uzc4ZVtgMuKzGDgeo83",
  receiptCommitmentHash: "07bd08c33d2e740e19a44f82fbfb0305815dcb63184b82bb8bc67870ce77b0fa",
  chunks: [
    {
      chunkIndex: 0,
      txSignature: "5EejmXv5V3ehJ5eDtZAPXVKFsUMv6jeJh2Phb8BvsbChvsXgE2XRJZZuoRFqZMw5HFtiMtT4chzPg3cjHzy78aay",
      slot: "525180127",
      payouts: [
        {
          recipient: "B5BQmVv7tjCBaHm8TwLdgY5jKxXpU14gptEspTouKgro",
          amount: 0.003,
          amountSol: 0.003,
          memo: "Lead Rust Engineer — Sprint 42 Payout",
        },
      ],
      protocolFee: {
        amountSol: 0.0000075,
        amount: 0.0000075,
        collector: "CochByMjwdvZTWVPK4GqV3po66TmnjLvBxsC3wexTHQ1",
        bps: 25,
      },
    },
  ],
};

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCpaCsv(run: BatchPayrollReport) {
  const headers = [
    "Date",
    "Run_ID",
    "Asset",
    "Mint",
    "Contractor_Address",
    "Role_Memo",
    "Disbursed_Amount",
    "Protocol_Fee",
    "Tx_Signature",
    "Block_Slot",
  ];
  const rows: string[] = [headers.join(",")];
  const dateStr = run.formattedDate || new Date(run.timestamp).toISOString();
  const assetStr = run.asset || "SOL";
  const mintStr = run.mint || (assetStr === "USDC" ? USDC_MINT.toString() : SOL_MINT.toString());

  for (const chunk of run.chunks) {
    const feePerContractor = chunk.payouts.length > 0
      ? (chunk.protocolFee.amount ?? chunk.protocolFee.amountSol ?? 0) / chunk.payouts.length
      : 0;
    for (const p of chunk.payouts) {
      const row = [
        `"${dateStr}"`,
        `"${run.id}"`,
        `"${assetStr}"`,
        `"${mintStr}"`,
        `"${p.recipient}"`,
        `"${(p.memo || "").replace(/"/g, '""')}"`,
        (p.amount ?? p.amountSol ?? 0).toString(),
        feePerContractor.toFixed(6),
        `"${chunk.txSignature}"`,
        `"${chunk.slot}"`,
      ];
      rows.push(row.join(","));
    }
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ciphra-cpa-ledger-${run.asset || "SOL"}-${run.id}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function App(): React.ReactElement {
  const [session, setSession] = useState<Session>();
  const [state, setState] = useState<Snapshot>();
  const [activity, setActivity] = useState<Activity[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [keys, setKeys] = useState("Preparing proving keys…");

  // View state: "landing" (marketing/comparison) vs "app" (live workspace)
  const [viewMode, setViewMode] = useState<"landing" | "app">("landing");

  // Hero comparison state
  const [heroComparison, setHeroComparison] = useState<"public" | "shielded">("shielded");

  // Solscan view toggle on Payroll Desk
  const [solscanPreview, setSolscanPreview] = useState(false);

  // 4-Stage Stepper during payroll
  const [proofStage, setProofStage] = useState<1 | 2 | 3 | 4>(1);

  // App navigation tab: "payroll" | "contractor" | "verify"
  const [activeTab, setActiveTab] = useState<"payroll" | "contractor" | "verify" | "stealth">("payroll");

  // Active Payroll Currency: "SOL" | "USDC"
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>("SOL");

  // Shield / Unshield modals
  const [showShieldModal, setShowShieldModal] = useState(false);
  const [showUnshieldModal, setShowUnshieldModal] = useState(false);
  const [shieldAmount, setShieldAmount] = useState("0.02");
  const [unshieldAmount, setUnshieldAmount] = useState("0.002");
  const [burner, setBurner] = useState<EphemeralBurner>();
  const [burnerAsset, setBurnerAsset] = useState<AssetSymbol>("SOL");
  const [burnerAmount, setBurnerAmount] = useState("0.01");
  const [swapQuote, setSwapQuote] = useState<StealthSwapQuote>();
  const [burnerNote, setBurnerNote] = useState("");
  const [relayerPubkey, setRelayerPubkey] = useState<string>();
  const [relayerNotice, setRelayerNotice] = useState(RELAYER_UNAVAILABLE_NOTICE);
  const liveJupiter = liveJupiterEnabled(network, import.meta.env.VITE_ENABLE_LIVE_JUPITER);

  // Switch active asset and populate corresponding amounts
  const handleSelectAsset = (asset: AssetSymbol) => {
    setSelectedAsset(asset);
    if (asset === "USDC") {
      setShieldAmount("50");
      setUnshieldAmount("25");
      // If contractors have default sample amounts, switch to USDC sample
      if (
        contractors.length === 3 &&
        (contractors[0]?.amountSol === 0.001 || contractors[0]?.amount === 0.001)
      ) {
        setContractors(SAMPLE_CONTRACTORS_USDC);
      }
    } else {
      setShieldAmount("0.02");
      setUnshieldAmount("0.002");
      if (
        contractors.length === 3 &&
        (contractors[0]?.amountSol === 4500 || contractors[0]?.amount === 4500)
      ) {
        setContractors(SAMPLE_CONTRACTORS_SOL);
      }
    }
  };

  // Payroll Desk state
  const [contractors, setContractors] = useState<PayrollRecipientInput[]>(SAMPLE_CONTRACTORS);
  const [antiCorrelationJitter, setAntiCorrelationJitter] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvInput, setCsvInput] = useState("");
  const [payrollProgress, setPayrollProgress] = useState("");
  const [persistPayrollHistory, setPersistPayrollHistory] = useState(() => {
    try {
      return localStorage.getItem(PERSIST_PAYROLL_HISTORY_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [historyNotice, setHistoryNotice] = useState("");
  const [recentPayrollRuns, setRecentPayrollRuns] = useState<BatchPayrollReport[]>(() => {
    try {
      if (localStorage.getItem(PERSIST_PAYROLL_HISTORY_KEY) !== "1") return [];
      const stored = localStorage.getItem(RECENT_PAYROLL_RUNS_KEY);
      return stored ? JSON.parse(stored) as BatchPayrollReport[] : [];
    } catch {
      return [];
    }
  });

  // Selected batch run for detail view modal
  const [selectedRunDetail, setSelectedRunDetail] = useState<BatchPayrollReport | null>(null);

  // Audit Verifier state
  const [receiptInput, setReceiptInput] = useState("");
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verificationError, setVerificationError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyMode, setVerifyMode] = useState<VerifyAuditMode>("paystub");
  const [viewingKeyInput, setViewingKeyInput] = useState("");
  const [useConnectedKey, setUseConnectedKey] = useState(true);
  const [employerWarned, setEmployerWarned] = useState(false);

  // Copy feedback
  const [copiedText, setCopiedText] = useState("");

  // Wallet Connection state
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const activeWalletInfo = getActiveWalletInfo(session?.signer?.address);

  // On-Chain Treasury Leak Scanner state
  const [scannerInput, setScannerInput] = useState(SAMPLE_DAO_TREASURY);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerResult, setScannerResult] = useState<ExposureScanResult | null>(null);
  const [scannerError, setScannerError] = useState("");

  const handleConnectWallet = async (type: "phantom" | "solflare") => {
    setWalletConnecting(true);
    setWalletError("");
    try {
      await connectBrowserWallet(type, network);
      setShowWalletModal(false);
      setSession(undefined);
      setState(undefined);
      setError("");
      setSessionEpoch((epoch) => epoch + 1);
    } catch (err: any) {
      setWalletError(err?.message || String(err));
    } finally {
      setWalletConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    disconnectBrowserWallet(network);
    setShowWalletModal(false);
    location.reload();
  };

  const handleScanExposure = async (addrToScan?: string) => {
    const target = addrToScan || scannerInput;
    if (!target.trim()) return;
    setScannerLoading(true);
    setScannerError("");
    try {
      const res = await scanWalletExposure(target.trim(), endpoints.solanaRpcUrl);
      setScannerResult(res);
    } catch (err: any) {
      setScannerError(err?.message || "Failed to scan wallet exposure.");
    } finally {
      setScannerLoading(false);
    }
  };

  useEffect(() => {
    if (persistPayrollHistory) return;
    try {
      localStorage.removeItem(RECENT_PAYROLL_RUNS_KEY);
      localStorage.removeItem("veilpay_recent_runs");
    } catch {
      // Storage can be unavailable in a locked-down browser.
    }
  }, [persistPayrollHistory]);

  const current = useRef<Activity | undefined>(undefined);
  const nextId = useRef(1);

  const onMeasurement = useCallback((measurement: Measurement) => {
    const entry = current.current;
    if (entry === undefined || measurement.step !== "transfer-prove" || measurement.ms === 0) return;
    entry.proofs.push({ ms: measurement.ms, ...(measurement.note === undefined ? {} : { note: measurement.note }) });
    setActivity((list) => [...list]);
  }, []);

  useEffect(() => {
    if (viewMode !== "app") return;
    let cancelled = false;
    void openSession(sessionUnlock(network), onMeasurement)
      .then(async (opened) => {
        if (cancelled) return;
        setSession(opened);
        setState(await snapshot(opened));
      })
      .catch((cause: unknown) => setError(String(cause)));
    return () => {
      cancelled = true;
    };
  }, [onMeasurement, sessionEpoch, viewMode]);

  useEffect(() => {
    if (session === undefined || activeTab !== "payroll") return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void session.prover
        .prefetch({ shapes: [shapeByLabel("1x2"), shapeByLabel("2x2")], onProgress: (update: KeyProgress) => {
          if (!cancelled) setKeys(keyStatus(update));
        } })
        .then(
          () => { if (!cancelled) setKeys("Proving keys ready"); },
          () => { if (!cancelled) setKeys("Proving keys load on first use"); },
        );
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [session, activeTab]);

  useEffect(() => {
    if (activeTab !== "stealth") return;
    let cancelled = false;
    void fetchRelayerStatus().then((status) => {
      if (cancelled) return;
      if (status.active) {
        setRelayerPubkey(status.pubkey);
        setRelayerNotice("Relayer fee-payer is active. The connected wallet does not sign as fee payer for unshield or sweep. The transaction includes a 0.005 SOL reimbursement to the relayer.");
      } else {
        setRelayerPubkey(undefined);
        setRelayerNotice(status.notice);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const run = async (label: string, action: (s: Session) => Promise<bigint | ExecutionResult | undefined>) => {
    if (session === undefined || busy) return;
    const entry: Activity = { id: nextId.current++, label, status: "running", proofs: [] };
    current.current = entry;
    setActivity((list) => [entry, ...list]);
    setBusy(true);
    setError("");
    try {
      const res = await action(session);
      const slot = typeof res === "object" && res !== null ? res.slot : typeof res === "bigint" ? res : undefined;
      setState(await snapshot(session, slot));
      entry.status = "done";
    } catch (cause) {
      entry.status = "failed";
      entry.detail = cause instanceof Error ? cause.message : String(cause);
    } finally {
      current.current = undefined;
      setActivity((list) => [...list]);
      setBusy(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(""), 2000);
  };

  // Add / remove contractor rows
  const addContractorRow = () => {
    const defaultAmt = selectedAsset === "USDC" ? 1000 : 0.001;
    setContractors((prev) => [...prev, { recipient: "", amountSol: defaultAmt, amount: defaultAmt, memo: "" }]);
  };

  const updateContractor = (index: number, field: keyof PayrollRecipientInput, value: any) => {
    setContractors((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, [field]: value };
      return next;
    });
  };

  const removeContractor = (index: number) => {
    setContractors((prev) => prev.filter((_, i) => i !== index));
  };

  const parseCsvData = () => {
    if (!csvInput.trim()) return;
    const lines = csvInput.trim().split("\n");
    const parsed: PayrollRecipientInput[] = [];
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        const recipient = parts[0]!;
        const amt = parseFloat(parts[1]!) || 0;
        const memo = parts[2] || `${selectedAsset} Payroll Payout`;
        if (isAddress(recipient) && amt > 0) {
          parsed.push({ recipient, amountSol: amt, amount: amt, memo });
        }
      }
    }
    if (parsed.length > 0) {
      setContractors(parsed);
      setShowCsvModal(false);
      setCsvInput("");
    }
  };

  // Execute Batch Payroll with 4-stage stepper
  const handleExecutePayroll = async () => {
    if (!session || busy) return;
    const validRecipients = contractors.filter(
      (c) => isAddress(c.recipient) && (c.amountSol ?? c.amount ?? 0) > 0
    );
    if (validRecipients.length === 0) {
      setError("Please add at least one valid recipient address and amount.");
      return;
    }

    setBusy(true);
    setProofStage(1);
    setPayrollProgress(`Stage 1/4: Selecting shielded ${selectedAsset} UTXO notes from private treasury…`);
    setError("");

    try {
      setTimeout(() => {
        setProofStage(2);
        setPayrollProgress(`Stage 2/4: Generating in-browser Groth16 zero-knowledge proof for ${selectedAsset} batch…`);
      }, 700);

      const feeCollector = resolveProtocolFeeCollector(session.signer.address);
      const report = await runBatchPayroll(
        session,
        validRecipients,
        {
          asset: selectedAsset,
          protocolFeeBps: DEFAULT_PROTOCOL_FEE_BPS,
          feeCollector,
          antiCorrelationJitter,
          onProgress: (status: string) => {
            setPayrollProgress(status);
            if (status.includes("jitter") || status.includes("Staggering")) {
              setProofStage(3);
            } else if (status.includes("Confirming") || status.includes("Submitting")) {
              setProofStage(4);
            }
          },
        }
      );

      setProofStage(4);
      setPayrollProgress(`Stage 4/4: Finalized ${selectedAsset} batch on Solana ${networkLabel}!`);

      // Attach tamper-evident SHA-256 commitment hash & Ed25519 signature to the report
      const reportWithHash = await attachCommitmentHashes(session, report);

      // Receipts stay in memory unless the employer opts in. Amounts are not written by default.
      const updatedRuns = [reportWithHash, ...recentPayrollRuns].slice(0, 20);
      setRecentPayrollRuns(updatedRuns);
      if (persistPayrollHistory) {
        localStorage.setItem(RECENT_PAYROLL_RUNS_KEY, JSON.stringify(updatedRuns));
      }

      // Refresh snapshot
      const lastSlotStr = report.chunks[report.chunks.length - 1]?.slot;
      const lastSlot = lastSlotStr ? BigInt(lastSlotStr) : undefined;
      setState(await snapshot(session, lastSlot));
      setTimeout(() => setPayrollProgress(""), 2000);
    } catch (err: any) {
      setError(err?.message || String(err));
      setPayrollProgress("");
    } finally {
      setBusy(false);
    }
  };

  // Verify Audit Receipt
  const handleVerifyReceipt = async () => {
    if (!receiptInput.trim()) return;
    if (!session) {
      setVerificationError("This browser is still connecting. The form is ready — decrypt again in a moment.");
      return;
    }
    if (verifyMode === "employer" && !employerWarned) {
      setVerificationError("Confirm the employer warning first. That key opens change and every recipient output.");
      return;
    }
    setVerifying(true);
    setVerificationError("");
    setVerificationResult(null);
    let secret: Uint8Array | undefined;
    try {
      if (!useConnectedKey) secret = parseViewingKeyBytes(viewingKeyInput);
      const result = await verifyAuditReceipt(session, receiptInput.trim(), {
        mode: verifyMode,
        ...(secret !== undefined ? { viewingKey: secret } : { useSessionKey: true as const }),
      });
      setVerificationResult(result);
    } catch (err: any) {
      setVerificationError(err?.message || "Verification failed");
    } finally {
      secret?.fill(0);
      setVerifying(false);
    }
  };

  const handleExportTransactionViewingKey = async () => {
    if (!session || !employerWarned) return;
    let signature = receiptInput.trim();
    try {
      const parsed = JSON.parse(receiptInput);
      signature = parsed.txSignature || parsed.chunks?.[0]?.txSignature || signature;
    } catch {
      signature = receiptInput.trim();
    }
    try {
      const secretHex = await exportBatchTransactionViewingKey(session, signature);
      await navigator.clipboard.writeText(secretHex);
      setCopiedText("tx-viewing-key");
      setTimeout(() => setCopiedText(""), 2000);
    } catch (err: any) {
      setVerificationError(err?.message || "Could not export the transaction viewing key");
    }
  };

  // Export single-contractor receipt with Ed25519 payer signature & commitment hash
  const exportSingleContractorReceipt = async (run: BatchPayrollReport, payout: PayrollPayoutRecord) => {
    if (!session) return;
    const single = await createSingleContractorReceipt(session, run, payout);
    downloadJson(`ciphra-receipt-${run.asset || "SOL"}-${payout.recipient.slice(0, 8)}.json`, single);
  };

  // Payroll desk totals with float precision formatting
  const totalPayrollNum = contractors.reduce((acc, c) => acc + (Number(c.amountSol ?? c.amount) || 0), 0);
  const ciphraFeeNum = totalPayrollNum * (DEFAULT_PROTOCOL_FEE_BPS / 10_000);
  const totalRequiredNum = totalPayrollNum + ciphraFeeNum;
  const totalPayrollStr = `${formatSol(totalPayrollNum)} ${selectedAsset}`;
  const ciphraFeeStr = `${formatSol(ciphraFeeNum)} ${selectedAsset}`;
  const totalRequiredStr = `${formatSol(totalRequiredNum)} ${selectedAsset}`;
  const chunksNeeded = Math.ceil(contractors.length / 14) || 1;

  const landingView = <>
        <section className="hero-section">
          <p className="section-kicker">Solana confidential payroll</p>
          <h1 className="hero-headline">
            Private payroll<br />
            <em>for a public chain.</em>
          </h1>
          <p className="hero-subheadline">
            Pay contractors without publishing salaries or the company burn rate. The Default Ring hides amounts, not recipients. Hiding recipient addresses requires Custom Rings, which are still in audit. Proofs run in the browser. A paystub opens one note. A batch audit opens the rest, on purpose.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                setViewMode("app");
                setActiveTab("payroll");
              }}
            >
              Open the desk
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setViewMode("app");
                setActiveTab("verify");
              }}
            >
              Verify a receipt
            </button>
          </div>
        </section>

        <div className="rail" aria-hidden="true">
          <div className="rail-track">
            {["Shielded notes", "Groth16", "One-note paystub", "Batch audit", "SOL", "USDC", "Nullifiers", "Client-side decrypt", "Shielded notes", "Groth16", "One-note paystub", "Batch audit", "SOL", "USDC", "Nullifiers", "Client-side decrypt"].map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
        </div>

        <section className="hero-section" style={{ paddingTop: 0 }}>

          {/* ========================================================
              VIRAL ON-CHAIN TREASURY LEAK SCANNER
              ======================================================== */}
          <div className="scanner-container">
            <div className="scanner-header">
              <div>
                <div className="scanner-badge-row">
                  <div className="scanner-live-tag">
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#EF4444" }} />
                    LIVE ON-CHAIN AUDIT ENGINE
                  </div>
                  <span style={{ fontSize: "0.725rem", color: "var(--text-secondary)" }}>
                    Powered by Helius RPC & Solana Privacy Rings
                  </span>
                </div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "0.2rem", letterSpacing: "-0.02em" }}>
                  Check Your Wallet's Burn-Rate Exposure
                </h2>
                <p className="muted" style={{ fontSize: "0.825rem", marginTop: "0.2rem" }}>
                  Standard Solana transfers leak your exact monthly OPEX, runway, contractor bonuses, and team salary tiers to public scrapers.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-outline-emerald btn-sm"
                onClick={() => {
                  setScannerInput(SAMPLE_DAO_TREASURY);
                  void handleScanExposure(SAMPLE_DAO_TREASURY);
                }}
                title="Populate and analyze our real active Devnet treasury account"
              >
                ⚡ Scan Sample DAO Treasury
              </button>
            </div>

            {/* Address Input & Scan Trigger */}
            <div className="scanner-search-box">
              <input
                className="scanner-input"
                type="text"
                placeholder="Enter Solana Treasury / Payroll Address (e.g. CochBy…HQ1)"
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={scannerLoading || !scannerInput.trim()}
                onClick={() => void handleScanExposure()}
              >
                {scannerLoading ? "Analyzing On-Chain History…" : "🔍 Scan Exposure"}
              </button>
            </div>

            {scannerError && (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "1.25rem", color: "#FCA5A5", fontSize: "0.85rem" }}>
                {scannerError}
              </div>
            )}

            {scannerLoading && (
              <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                <div className="spinner" style={{ width: "2rem", height: "2rem", marginBottom: "0.75rem", borderTopColor: "#EF4444" }} />
                <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Querying Solana RPC for public signatures and balance…</div>
                <div className="muted" style={{ fontSize: "0.775rem" }}>Reconstructing public transfer graph, timing intervals, and contractor memo tags</div>
              </div>
            )}

            {/* Results Display */}
            {!scannerLoading && scannerResult && (
              <div>
                {/* Vulnerability Banner */}
                <div style={{
                  background: scannerResult.riskScore === "CRITICAL" ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)",
                  border: `1px solid ${scannerResult.riskScore === "CRITICAL" ? "rgba(239, 68, 68, 0.35)" : "rgba(245, 158, 11, 0.35)"}`,
                  borderRadius: "0.625rem",
                  padding: "0.85rem 1.15rem",
                  marginBottom: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "1rem" }}>🚨</span>
                      <strong style={{ color: scannerResult.riskScore === "CRITICAL" ? "#FCA5A5" : "#FDE68A", fontSize: "0.9rem" }}>
                        RISK LEVEL: {scannerResult.riskScore} BURN-RATE LEAKAGE
                      </strong>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {scannerResult.leakSummary}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: "0.75rem", background: "rgba(0,0,0,0.3)", padding: "0.25rem 0.5rem", borderRadius: "0.25rem", color: "var(--text-secondary)" }}>
                    Target: {scannerResult.address.slice(0, 6)}…{scannerResult.address.slice(-6)}
                  </span>
                </div>

                {/* 3 Metrics Cards */}
                <div className="scanner-metric-grid">
                  <div className="scanner-metric-card">
                    <div className="scanner-metric-label">Exposed Outgoing Volume</div>
                    <div className="scanner-metric-val" style={{ color: "#F87171" }}>
                      {scannerResult.exposedVolumeSol} SOL
                    </div>
                    <div className="muted" style={{ fontSize: "0.725rem", marginTop: "0.2rem" }}>
                      {scannerResult.exposedVolumeUsdc > 0 ? `+ ${scannerResult.exposedVolumeUsdc.toLocaleString()} USDC Leaked` : "Standard Public Transfers"}
                    </div>
                  </div>

                  <div className="scanner-metric-card">
                    <div className="scanner-metric-label">Contractor Wallets Scraped</div>
                    <div className="scanner-metric-val" style={{ color: "#FBBF24" }}>
                      {scannerResult.recipientCount} Recipients
                    </div>
                    <div className="muted" style={{ fontSize: "0.725rem", marginTop: "0.2rem" }}>
                      Salary hierarchy indexable on Solscan
                    </div>
                  </div>

                  <div className="scanner-metric-card">
                    <div className="scanner-metric-label">Recurring Cadence Risk</div>
                    <div className="scanner-metric-val" style={{ fontSize: "1.1rem", color: "#60A5FA" }}>
                      {scannerResult.recurringCadence.includes("Bi-weekly") ? "Bi-Weekly (Sprint)" : "Monthly Recurring"}
                    </div>
                    <div className="muted" style={{ fontSize: "0.725rem", marginTop: "0.2rem" }}>
                      Vulnerable to temporal graph clustering
                    </div>
                  </div>
                </div>

                {/* Detected Recurring Leaks Table */}
                {scannerResult.leakedDisbursements.length > 0 && (
                  <div className="scanner-pattern-wrap">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
                        Detected Recurring Public Payouts
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        Scraped from recent blocks
                      </span>
                    </div>

                    {scannerResult.leakedDisbursements.map((d, i) => (
                      <div key={i} className="scanner-pattern-row">
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {d.role}
                          </div>
                          <div className="mono" style={{ fontSize: "0.725rem", color: "var(--text-secondary)" }}>
                            To: {d.recipient}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div className="mono" style={{ fontWeight: 700, color: "#F87171" }}>
                            {d.amount}
                          </div>
                          <a
                            href={`https://solscan.io/tx/${d.txSignature}?cluster=devnet`}
                            target="_blank"
                            rel="noreferrer"
                            className="mono"
                            style={{ fontSize: "0.725rem", color: "var(--cyan-primary)", textDecoration: "none" }}
                          >
                            Block #{d.slot} ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 1-Click Viral CTA */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "0.625rem", padding: "1rem 1.25rem", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#34D399", fontSize: "0.95rem" }}>
                      Defeat On-Chain Burn Rate Leaks with Ciphra
                    </div>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      One payroll transaction sends at most 14 contractors plus the protocol fee (15 payments) through buildMultiTransferTransaction.
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ whiteSpace: "nowrap", padding: "0.7rem 1.4rem" }}
                    onClick={() => {
                      setViewMode("app");
                      setActiveTab("payroll");
                    }}
                  >
                    Shield These Payouts with Ciphra →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Hero Comparison Card */}
          <div className="card-specular comparison-container">
            <div className="comparison-header">
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>
                  On-Chain Privacy Architecture
                </span>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.15rem" }}>
                  {heroComparison === "public" ? "Standard Solana Transfer (Publicly Scraped)" : "Ciphra Shielded Proof (Encrypted UTXO)"}
                </h3>
              </div>

              <div className="view-toggle-pill">
                <button
                  type="button"
                  className={`view-toggle-btn ${heroComparison === "public" ? "active" : ""}`}
                  onClick={() => setHeroComparison("public")}
                >
                  Public Solscan
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${heroComparison === "shielded" ? "active" : ""}`}
                  onClick={() => setHeroComparison("shielded")}
                >
                  🛡️ Ciphra Shielded
                </button>
              </div>
            </div>

            <div className="comparison-body">
              {heroComparison === "public" ? (
                <div>
                  <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", padding: "0.75rem 1rem", borderRadius: "0.5rem", marginBottom: "1rem", fontSize: "0.8rem", color: "#FCA5A5" }}>
                    ⚠️ <strong>Exploitation Vector:</strong> Public blockchain balances and recipient wallets are tracked by AI bots, revealing total corporate burn rate and internal payroll hierarchy.
                  </div>
                  <div className="comparison-row">
                    <span style={{ color: "var(--text-secondary)" }}>Employer Treasury</span>
                    <span style={{ color: "var(--text-primary)" }}>EmployerTreasury.sol (Balance: 245.8 SOL)</span>
                  </div>
                  <div className="comparison-row">
                    <span style={{ color: "var(--text-secondary)" }}>Disbursement #1</span>
                    <span style={{ color: "var(--amber-primary)" }}>Alice (Lead Rust Dev): 4,500 USDC</span>
                  </div>
                  <div className="comparison-row">
                    <span style={{ color: "var(--text-secondary)" }}>Disbursement #2</span>
                    <span style={{ color: "var(--amber-primary)" }}>Bob (Senior Auditor): 8,000 USDC</span>
                  </div>
                  <div className="comparison-row">
                    <span style={{ color: "var(--text-secondary)" }}>Disbursement #3</span>
                    <span style={{ color: "var(--amber-primary)" }}>Charlie (ZK Specialist): 12,000 USDC</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "0.75rem 1rem", borderRadius: "0.5rem", marginBottom: "1rem", fontSize: "0.8rem", color: "#6EE7B7" }}>
                    🛡️ <strong>Shielded transfer:</strong> buildMultiTransferTransaction builds one Groth16 proof. The Default Ring hides amounts, not recipients. Hiding recipient addresses requires Custom Rings, which are still in audit.
                  </div>
                  <div className="comparison-row">
                    <span style={{ color: "var(--text-secondary)" }}>Employer Treasury</span>
                    <span className="cipher-block">0x7a3f••••e29b [ENCRYPTED UTXO]</span>
                  </div>
                  <div className="comparison-row">
                    <span style={{ color: "var(--text-secondary)" }}>Output Note #1</span>
                    <span className="cipher-block">0x9c41••••11f8 [ENCRYPTED NOTE]</span>
                  </div>
                  <div className="comparison-row">
                    <span style={{ color: "var(--text-secondary)" }}>Output Note #2</span>
                    <span className="cipher-block">0x3d02••••77ca [ENCRYPTED NOTE]</span>
                  </div>
                  <div className="comparison-row">
                    <span style={{ color: "var(--text-secondary)" }}>Protocol Fee (0.50%)</span>
                    <span style={{ color: "#34D399" }}>0.000022 SOL (Ciphra Protocol Vault)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </section>

        <section>
          <p className="section-kicker">The product</p>
          <h2 className="section-title">Better rails for a payment that should stay quiet.</h2>
          <div className="product-list">
            <article className="product-row">
              <span className="product-index">01</span>
              <div>
                <h3>Payroll</h3>
                <p>
                  One call to buildMultiTransferTransaction. Up to 14 contractors plus the protocol fee. The Default Ring hides amounts, not recipients. Hiding recipient addresses requires Custom Rings, which are still in audit. Proving stays on this device until you opt into a remote merge.
                </p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => { setViewMode("app"); setActiveTab("payroll"); }}>
                Open
              </button>
            </article>
            <article className="product-row">
              <span className="product-index">02</span>
              <div>
                <h3>Paystub</h3>
                <p>
                  A contractor decrypts their own note in their own browser. The 32-byte viewing key opens every incoming note, so it never leaves that machine.
                </p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => { setViewMode("app"); setActiveTab("verify"); }}>
                Verify
              </button>
            </article>
            <article className="product-row">
              <span className="product-index">03</span>
              <div>
                <h3>Exposure</h3>
                <p>
                  A public Solana treasury already prints salaries, recipients, and cadence. Scan one address and see the leak before you shield the next run.
                </p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => { setScannerInput(SAMPLE_DAO_TREASURY); void handleScanExposure(SAMPLE_DAO_TREASURY); }}>
                Scan
              </button>
            </article>
          </div>
          <footer className="site-footer">
            <span>Ciphra</span>
            <span>Solana Privacy Rings · proofs in the browser</span>
          </footer>
        </section>
        </>;

  const verifyView = (
            <div className="card-specular table-panel page-enter">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                    Selective Cryptographic Audit Verifier
                  </h2>
                  <p className="muted" style={{ fontSize: "0.8rem" }}>
                    Amounts come from decrypting the indexed ciphertext. A pasted receipt is only a cross-check.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setReceiptInput(JSON.stringify(SAMPLE_AUDIT_RECEIPT, null, 2))}
                    title="Load a verified sample audit receipt from Devnet"
                  >
                    ⚡ Load Demo Audit Receipt
                  </button>
                  {recentPayrollRuns.length > 0 && (
                    <button
                      className="btn btn-outline-emerald btn-sm"
                      onClick={() => setReceiptInput(JSON.stringify(recentPayrollRuns[0], null, 2))}
                    >
                      📄 Paste Latest Run Receipt
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <button
                  className={`btn btn-sm ${verifyMode === "paystub" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setVerifyMode("paystub")}
                  type="button"
                >
                  Single-recipient paystub
                </button>
                <button
                  className={`btn btn-sm ${verifyMode === "employer" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setVerifyMode("employer")}
                  type="button"
                >
                  Employer / CPA batch audit
                </button>
              </div>
              <p className="muted" style={{ fontSize: "0.78rem", marginBottom: "0.75rem" }}>
                {verifyMode === "paystub"
                  ? "Paystub mode opens notes for one viewing key. If this wallet sent the batch and is not a listed payee, verification opens every output instead of treating the sender's change as the payment."
                  : "Batch audit derives transactionViewingKey(firstNullifier) and calls decryptSlotEphemeral on every slot. That opens sender change and every recipient."}
              </p>
              {verifyMode === "paystub" && (
                <div style={{ background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.45)", padding: "0.75rem 1rem", borderRadius: "0.5rem", color: "#FCD34D", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
                  Your 32-byte ViewingKey opens ALL incoming notes to your wallet—only use it in your own browser; never paste it on a third party's device.
                </div>
              )}
              {verifyMode === "employer" && (
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.78rem", marginBottom: "0.75rem" }}>
                  <input
                    type="checkbox"
                    checked={employerWarned}
                    onChange={(event) => setEmployerWarned(event.target.checked)}
                  />
                  <span>
                    I understand this transaction viewing key reveals change and every recipient in the batch. It is not a single-contractor paystub.
                  </span>
                </label>
              )}
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.78rem", marginBottom: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={useConnectedKey}
                  onChange={(event) => setUseConnectedKey(event.target.checked)}
                />
                Use the connected wallet. The viewing key is not written to Local Storage.
              </label>
              {!useConnectedKey && (
                <textarea
                  className="csv-textarea"
                  placeholder="32-byte viewing key, hex or base58. Not the 64-byte ed25519 derivation signature."
                  value={viewingKeyInput}
                  onChange={(event) => setViewingKeyInput(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  style={{ height: "4.5rem", marginBottom: "0.75rem" }}
                />
              )}
              <textarea
                className="csv-textarea"
                placeholder="Paste a transaction signature, or a Ciphra receipt JSON. Receipt amounts are checked against the decrypted notes."
                value={receiptInput}
                onChange={(e) => setReceiptInput(e.target.value)}
                style={{ height: "8.5rem", marginBottom: "1rem" }}
              />

              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  disabled={verifying || !receiptInput.trim() || (!useConnectedKey && !viewingKeyInput.trim())}
                  onClick={handleVerifyReceipt}
                >
                  {verifying ? "Decrypting indexed notes…" : "Decrypt and verify on-chain"}
                </button>
                {verifyMode === "employer" && (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={!employerWarned || !receiptInput.trim()}
                    onClick={handleExportTransactionViewingKey}
                  >
                    {copiedText === "tx-viewing-key" ? "Copied transaction viewing key" : "Export batch transaction viewing key"}
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setReceiptInput("");
                    setVerificationResult(null);
                    setVerificationError("");
                  }}
                >
                  Clear
                </button>
              </div>

              {verificationError && (
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "0.75rem 1rem", borderRadius: "0.5rem", color: "#FCA5A5", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                  Verification Failed: {verificationError}
                </div>
              )}

              {/* Holographic Verified Certificate Card */}
              {verificationResult && (
                <div className="holographic-cert">
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0.65rem", borderRadius: "9999px", background: verificationResult.integrity === "VERIFIED" ? "rgba(16, 185, 129, 0.15)" : verificationResult.integrity === "NOTHING_TO_VERIFY" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)", border: `1px solid ${verificationResult.integrity === "VERIFIED" ? "rgba(16, 185, 129, 0.4)" : verificationResult.integrity === "NOTHING_TO_VERIFY" ? "rgba(245, 158, 11, 0.45)" : "rgba(239, 68, 68, 0.4)"}`, color: verificationResult.integrity === "VERIFIED" ? "#34D399" : verificationResult.integrity === "NOTHING_TO_VERIFY" ? "#FCD34D" : "#FCA5A5", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span>🛡️</span>
                      <span>{verificationResult.integrity === "TAMPERED"
                        ? "TAMPERED — RECEIPT ≠ DECRYPTED NOTES"
                        : verificationResult.integrity === "NOTHING_TO_VERIFY"
                          ? "Nothing to verify — on-chain notes decrypted only"
                          : verificationResult.integrity === "FAILED"
                            ? "FAILED — Zero on-chain notes were decrypted with this key."
                            : verificationResult.integrity === "UNSUPPORTED_RECEIPT"
                              ? "Unsupported receipt — payout lines have no shielded address"
                              : "DECRYPTED FROM THE INDEXED TRANSACTION"}</span>
                    </div>
                    {verificationResult.payerSignatureVerified && (
                      <span style={{ paddingLeft: "0.5rem", borderLeft: "1px solid rgba(16, 185, 129, 0.4)", color: "#10B981" }}>
                        ✓ Ed25519 Payer Authenticated
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: "1.35rem", fontWeight: 800, marginBottom: "0.25rem" }}>
                    Ciphra Zero-Knowledge Audit Certificate
                  </h3>
                  <p className="muted" style={{ fontSize: "0.825rem", marginBottom: "1.5rem" }}>
                    Verified On-Chain Execution & Tamper-Evident Receipt Binding. Transaction confirmed against Solana Privacy Rings & Helius Devnet RPC.
                  </p>

                  <div className="cert-meta-grid">
                    <div className="cert-meta-item">
                      <span className="cert-meta-label">On-Chain Tx Signature</span>
                      <a
                        href={`https://solscan.io/tx/${verificationResult.txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="mono"
                        style={{ color: "var(--cyan-primary)", fontSize: "0.85rem", textDecoration: "none" }}
                      >
                        {verificationResult.txSignature.slice(0, 16)}…{verificationResult.txSignature.slice(-8)} ↗
                      </a>
                    </div>

                    <div className="cert-meta-item">
                      <span className="cert-meta-label">Landed Block Slot</span>
                      <span className="cert-meta-val">#{verificationResult.slot}</span>
                    </div>

                    <div className="cert-meta-item">
                      <span className="cert-meta-label">Disbursed Currency / Asset</span>
                      <span className="cert-meta-val" style={{ color: verificationResult.asset === "USDC" ? "#60A5FA" : "#34D399", fontWeight: 700 }}>
                        {verificationResult.asset || "SOL"} ({verificationResult.decimals ?? (verificationResult.asset === "USDC" ? 6 : 9)} decimals)
                      </span>
                    </div>

                    <div className="cert-meta-item">
                      <span className="cert-meta-label">Total Verified Disbursement</span>
                      <span className="cert-meta-val" style={{ color: verificationResult.asset === "USDC" ? "#60A5FA" : "#34D399", fontWeight: 700 }}>
                        {formatSol(verificationResult.totalDisclosed ?? verificationResult.totalDisclosedSol)} {verificationResult.asset || "SOL"}
                      </span>
                    </div>

                    <div className="cert-meta-item">
                      <span className="cert-meta-label">Privacy Ring Program</span>
                      <span className="cert-meta-val" style={{ fontSize: "0.8rem" }}>
                        {verificationResult.ringProgramId}
                      </span>
                    </div>

                    <div className="cert-meta-item">
                      <span className="cert-meta-label">Attesting Payer Wallet</span>
                      <span className="cert-meta-val mono" style={{ fontSize: "0.85rem" }}>
                        {verificationResult.payerPubkey
                          ? `${verificationResult.payerPubkey.slice(0, 6)}…${verificationResult.payerPubkey.slice(-6)}`
                          : "—"}
                      </span>
                    </div>

                    <div className="cert-meta-item">
                      <span className="cert-meta-label">Protocol Fee ({verificationResult.protocolFee?.bps != null ? `${(verificationResult.protocolFee.bps / 100).toFixed(2)}%` : "0.50%"})</span>
                      <span className="cert-meta-val" style={{ fontSize: "0.85rem" }}>
                        {verificationResult.protocolFee
                          ? `${formatSol(verificationResult.protocolFee.amount ?? verificationResult.protocolFee.amountSol ?? 0)} ${verificationResult.asset || "SOL"}`
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Integrity Verification Checks */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem", marginTop: "1rem", padding: "0.75rem", background: "rgba(255, 255, 255, 0.02)", borderRadius: "0.5rem", border: "1px solid var(--border-card)" }}>
                    <div style={{ fontSize: "0.775rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>On-Chain Tx Success: </span>
                      <span style={{ color: verificationResult.txSuccessConfirmed ? "#34D399" : "#F87171", fontWeight: 600 }}>
                        {verificationResult.txSuccessConfirmed ? "✓ meta.err === null" : "✕ Failed"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.775rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Slot Match: </span>
                      <span style={{ color: verificationResult.onChainSlotMatch ? "#34D399" : "#FBBF24", fontWeight: 600 }}>
                        {verificationResult.onChainSlotMatch ? "✓ Confirmed" : "⚠ Mismatch"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.775rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Privacy Rings Program: </span>
                      <span style={{ color: verificationResult.programInvocationConfirmed ? "#34D399" : "#FBBF24", fontWeight: 600 }}>
                        {verificationResult.programInvocationConfirmed ? "✓ ring1GaLC…XANW" : "— Not verified"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.775rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>SHA-256 Commitment: </span>
                      <span style={{ color: verificationResult.commitmentVerified === true ? "#34D399" : verificationResult.commitmentVerified === false ? "#F87171" : "var(--text-muted)", fontWeight: 600 }}>
                        {verificationResult.commitmentVerified === true
                          ? "✓ Tamper-evident digest matches"
                          : verificationResult.commitmentVerified === false
                          ? "✕ Digest mismatch — tampered"
                          : "— No hash in receipt"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.775rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Ed25519 Payer Signature: </span>
                      <span style={{ color: verificationResult.payerSignatureVerified ? "#34D399" : "#F87171", fontWeight: 600 }}>
                        {verificationResult.payerSignatureVerified
                          ? `✓ Authenticated (${verificationResult.payerPubkey?.slice(0, 4)}…${verificationResult.payerPubkey?.slice(-4)})`
                          : "✕ Unverified Signature"}
                      </span>
                    </div>
                  </div>

                  {/* Institutional Attestation Clarification */}
                  <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "0.375rem" }}>
                    <p style={{ fontSize: "0.775rem", margin: 0, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                      <strong style={{ color: "#34D399" }}>Institutional Attestation Notice:</strong> Disclosed payout amounts, recipient addresses, and block slots are cryptographically bound and attested by the payer's Ed25519 digital signature, while shielded company treasury balances remain zero-knowledge encrypted on Solana Privacy Rings.
                    </p>
                  </div>

                  {verificationResult.receiptCommitmentHash && (
                    <div style={{ marginTop: "0.5rem", padding: "0.5rem 0.75rem", background: "rgba(255, 255, 255, 0.02)", borderRadius: "0.375rem", border: "1px solid var(--border-card)" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Receipt Commitment Hash (SHA-256): </span>
                      <code className="mono" style={{ fontSize: "0.7rem", color: "var(--cyan-primary)", wordBreak: "break-all" }}>
                        {verificationResult.receiptCommitmentHash}
                      </code>
                    </div>
                  )}

                  {/* Disclosed Payouts Table */}
                  <div style={{ marginTop: "1.25rem" }}>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    On-chain decrypted outputs ({verificationResult.integrity})
                  </h4>
                  {verificationResult.integrity !== "VERIFIED" && verificationResult.tamperReason && (
                    <p style={{ color: verificationResult.integrity === "NOTHING_TO_VERIFY" ? "#FCD34D" : "#FCA5A5", fontSize: "0.8rem" }}>{verificationResult.tamperReason}</p>
                  )}
                    <div className="payroll-table-wrap">
                      <table className="payroll-table">
                        <thead>
                          <tr>
                            <th>Slot</th>
                            <th>Role</th>
                            <th>Mint</th>
                            <th>Amount</th>
                            <th>Viewing key</th>
                          </tr>
                        </thead>
                        <tbody>
                          {verificationResult.decryptedOutputs.map((note) => (
                            <tr key={`${note.signature}-${note.slotIndex}`}>
                              <td className="mono">{note.slotIndex}</td>
                              <td>{note.role}</td>
                              <td className="mono" style={{ fontSize: "0.75rem" }}>{note.mint}</td>
                              <td className="mono" style={{ fontWeight: 600 }}>{note.amountDisplay}</td>
                              <td className="mono" style={{ fontSize: "0.75rem" }}>{note.recipientViewingKey.slice(0, 12)}…</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(verificationResult.txSignature, "hash")}
                    >
                      {copiedText === "hash" ? "Copied Hash!" : "📋 Copy Verification Hash"}
                    </button>
                    <button
                      className="btn btn-outline-emerald btn-sm"
                      onClick={() => downloadJson(`ciphra-certificate-${verificationResult.txSignature.slice(0, 8)}.json`, verificationResult)}
                    >
                      ⬇️ Download Certificate JSON
                    </button>
                  </div>
                </div>
              )}
            </div>
  );

  // Loading state
  if (session === undefined || state === undefined) {
    return (
      <main className="app-container">
        <header className="nav-header">
          <p className="demo-banner" role="status">Devnet demo — not for production funds.</p>
          <div className="brand-wrap" onClick={() => setViewMode("landing")}>
            <span className="brand-text">Ciphra</span>
            <span className="brand-pill">Confidential payroll</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <div className="network-pill">
              <span>{networkLabel}</span>
            </div>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setViewMode("app"); setActiveTab("verify"); }}>
              Verify a receipt
            </button>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => { setViewMode("app"); setActiveTab("payroll"); }}>
              Open the desk
            </button>
          </div>
        </header>
        {viewMode === "landing" ? landingView : activeTab === "verify" ? (
        <section className="page-enter">
          <div className="workspace-tabs">
            <button className="workspace-tab" type="button" onClick={() => setActiveTab("payroll")}>Payroll</button>
            <button className="workspace-tab active" type="button">Verify</button>
          </div>
          <p className="connect-line">{error === "" ? "Opening the verifier. The wallet connects behind this form." : error}</p>
          {verifyView}
        </section>
        ) : (
        <div className="card-specular page-enter" style={{ textAlign: "center", padding: "4rem 2rem", margin: "3rem auto", maxWidth: "42rem" }}>
          {error === "" ? (
            <>
              <div className="spinner" style={{ margin: "0 auto 1.5rem", width: "2.5rem", height: "2.5rem" }} />
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Initializing WASM Groth16 Prover</h2>
              <p className="muted" style={{ fontSize: "0.875rem" }}>
                Connecting to Solana Devnet via Helius RPC & Photon Indexer…
              </p>
            </>
          ) : (
            <div>
              <div style={{ color: "var(--danger-primary)", fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                Connection Error
              </div>
              <p style={{ color: "var(--text-secondary)", marginBottom: "1.75rem", wordBreak: "break-word", fontSize: "0.875rem" }}>
                {error}
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <button className="btn btn-secondary" type="button" onClick={() => setViewMode("landing")}>
                  Back
                </button>
                <button className="btn btn-primary" onClick={() => location.reload()}>
                  Retry Connection
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    loadFundedDevnetSeed(network);
                    location.reload();
                  }}
                >
                  Load Funded Devnet Payer
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </main>
    );
  }

  const owner = session.signer.address;
  const inboundHistory = state.history.filter((h) => h.direction === "inbound" || h.kind === "deposit");

  const currentAssetConfig = ASSETS[selectedAsset];
  const currentAssetData = state.assets?.[selectedAsset] ?? {
    publicUnits: selectedAsset === "SOL" ? state.publicLamports : 0n,
    privateUnits: selectedAsset === "SOL" ? state.privateLamports : 0n,
    privateNotes: selectedAsset === "SOL" ? state.privateNotes : 0,
    localSpendLimit: selectedAsset === "SOL" ? state.localSpendLimit : 0n,
  };

  const formatAssetUnits = (units: bigint, decimals: number, symbol: string) => {
    return `${formatAmount(units, decimals)} ${symbol}`;
  };

  const formattedPrivate = formatAssetUnits(currentAssetData.privateUnits, currentAssetConfig.decimals, selectedAsset);
  const formattedSpendLimit = formatAssetUnits(currentAssetData.localSpendLimit, currentAssetConfig.decimals, selectedAsset);
  const formattedPublic = formatAssetUnits(currentAssetData.publicUnits, currentAssetConfig.decimals, selectedAsset);

  return (
    <main className="app-container">
      {/* Top Navbar */}
      <header className="nav-header">
        <p className="demo-banner" role="status">Devnet demo — not for production funds.</p>
        <div className="brand-wrap" onClick={() => setViewMode("landing")}>
          <div className="brand-logo">🛡️</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="brand-text">Ciphra</span>
              <span className="brand-pill">Confidential B2B</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <div className="network-pill">
            <span className="pulse-dot" />
            <span>{networkLabel}</span>
          </div>

          {/* Active Wallet Status & Switcher */}
          <button
            className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", borderColor: activeWalletInfo.isExternal ? "rgba(168, 85, 247, 0.45)" : undefined }}
            onClick={() => setShowWalletModal(true)}
            title="Wallet connection & network mode"
          >
            {activeWalletInfo.isExternal ? (
              <>
                <span style={{ color: "#C084FC" }}>🟣</span>
                <span>{activeWalletInfo.name}: {owner.slice(0, 4)}…{owner.slice(-4)}</span>
              </>
            ) : (
              <>
                <span style={{ color: "#34D399" }}>⚡</span>
                <span>{hasFundedDevnetPayer() ? `Demo Payer (${owner.slice(0, 4)}…${owner.slice(-4)})` : `Burner (${owner.slice(0, 4)}…${owner.slice(-4)})`}</span>
              </>
            )}
          </button>

          {!activeWalletInfo.isExternal && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowWalletModal(true)}
              title="Connect Phantom or Solflare browser wallet"
            >
              Connect Phantom / Solflare
            </button>
          )}

          {viewMode === "landing" ? (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setViewMode("app");
                  setActiveTab("verify");
                }}
              >
                Verify Receipt
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setViewMode("app");
                  setActiveTab("payroll");
                }}
              >
                Open Payroll App →
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setViewMode("landing")}
              >
                ← Overview
              </button>
              {hasFundedDevnetPayer() && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    loadFundedDevnetSeed(network);
                    location.reload();
                  }}
                  title="Switch to funded payer keypair"
                >
                  Load Funded Payer
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  resetBurner(network);
                  location.reload();
                }}
                title="Generate fresh testing keypair"
              >
                Reset Key
              </button>
            </>
          )}
        </div>
      </header>

      {/* ========================================================
          FLAGSHIP LANDING VIEW
          ======================================================== */}
      {viewMode === "landing" && landingView}

      {/* ========================================================
          UPGRADED APP WORKSPACE VIEW
          ======================================================== */}
      {viewMode === "app" && (
        <>
          {/* Unfunded Burner Alert Banner */}
          {owner !== FUNDED_PAYER_ADDRESS && state.publicLamports === 0n && (
            <div style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
              gap: "1rem"
            }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
                {hasFundedDevnetPayer() ? (
                  <>💡 You are currently on an unfunded testing wallet. Click <strong>Switch to Funded Payer</strong> to load your 9.98 SOL Devnet account (<code>CochBy…HQ1</code>).</>
                ) : (
                  <>💡 You are currently on an unfunded wallet. Connect <strong>Phantom / Solflare</strong> or request Devnet SOL from <code>faucet.solana.com</code>.</>
                )}
              </span>
              {hasFundedDevnetPayer() ? (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => {
                    loadFundedDevnetSeed(network);
                    location.reload();
                  }}
                >
                  ⚡ Switch to Funded Payer
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => setShowWalletModal(true)}
                >
                  🟣 Connect Wallet
                </button>
              )}
            </div>
          )}

          {/* Unified Treasury Telemetry Strip */}
          <div className="card-specular telemetry-strip">
            {/* Asset Pill Toggle: SOL | USDC */}
            <div className="telemetry-item">
              <span className="telemetry-label">Active Currency</span>
              <div className="asset-pill-group">
                <button
                  type="button"
                  className={`asset-pill-btn ${selectedAsset === "SOL" ? "active-sol" : ""}`}
                  onClick={() => handleSelectAsset("SOL")}
                  title="Switch to Native Solana (SOL)"
                >
                  <span className="asset-badge asset-badge-sol">◎</span>
                  <span>SOL</span>
                </button>
                <button
                  type="button"
                  className={`asset-pill-btn ${selectedAsset === "USDC" ? "active-usdc" : ""}`}
                  onClick={() => handleSelectAsset("USDC")}
                  title="Switch to Confidential USDC (SPL Token)"
                >
                  <span className="asset-badge asset-badge-usdc">$</span>
                  <span>USDC</span>
                </button>
              </div>
            </div>

            <div className="telemetry-item">
              <span className="telemetry-label">
                Shielded {selectedAsset} Treasury
                <span style={{ color: "#34D399" }}>● Private</span>
              </span>
              <span className={`telemetry-val ${selectedAsset === "USDC" ? "mono" : "emerald"}`} style={{ color: selectedAsset === "USDC" ? "#60A5FA" : undefined }}>
                {formattedPrivate}
              </span>
              <span className="telemetry-sub">Spend Limit: {formattedSpendLimit}</span>
            </div>

            <div className="telemetry-item">
              <span className="telemetry-label">
                {selectedAsset === "USDC" ? "Public USDC ATA" : "Public Fee Payer Balance"}
              </span>
              <span className="telemetry-val">{formattedPublic}</span>
              <span className="telemetry-sub">
                {selectedAsset === "USDC" ? "Devnet SPL Token Account" : "Network Gas & Fees"}
              </span>
            </div>

            <div className="telemetry-item">
              <span className="telemetry-label">
                {selectedAsset} UTXO Notes
                {state.mergingEnabled && (
                  <button
                    className="btn btn-outline-emerald btn-sm"
                    style={{ padding: "0.1rem 0.4rem", fontSize: "0.65rem", marginLeft: "0.25rem" }}
                    onClick={() => run("Merge Notes", actions.merge)}
                    title="Consolidate multiple notes into one"
                  >
                    Merge TEE
                  </button>
                )}
              </span>
              <span className="telemetry-val">{currentAssetData.privateNotes} Notes</span>
              <span className="telemetry-sub">
                {currentAssetData.privateNotes > 8 ? "⚠️ Notes exceed 8; merge recommended" : `Optimal for 1-proof ${selectedAsset} payout`}
              </span>
            </div>

            <div className="telemetry-item">
              <span className="telemetry-label">
                Connected Payer
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: "0.1rem 0.35rem", fontSize: "0.65rem", marginLeft: "0.25rem" }}
                  onClick={() => copyToClipboard(owner, "owner")}
                >
                  {copiedText === "owner" ? "Copied!" : "Copy"}
                </button>
              </span>
              <span className="telemetry-val mono" style={{ fontSize: "1rem" }}>
                {owner.slice(0, 6)}…{owner.slice(-6)}
              </span>
              <span className="telemetry-sub" style={{ color: state.registered ? "#34D399" : "var(--amber-primary)" }}>
                {state.registered ? "● Registered (Active)" : "○ Unregistered"}
              </span>
            </div>

            <div className="telemetry-actions">
              <button
                className={`btn btn-sm ${selectedAsset === "USDC" ? "btn-primary" : "btn-outline-emerald"}`}
                onClick={() => setShowShieldModal(true)}
              >
                + Shield {selectedAsset}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowUnshieldModal(true)}>
                Unshield
              </button>
            </div>
          </div>

          {/* Unregistered Alert Banner */}
          {!state.registered && (
            <div className="card-specular" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem", borderColor: "var(--cyan-primary)", background: "rgba(6, 182, 212, 0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.25rem" }}>Register Ciphra Private Wallet</h3>
                  <p className="muted" style={{ fontSize: "0.825rem" }}>
                    Your Solana account must register its viewing and nullifier public keys on the user registry before receiving or sending private payments.
                  </p>
                </div>
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run("Register", actions.register)}>
                  Register on Devnet
                </button>
              </div>
            </div>
          )}

          {/* Linear-Style Tabs */}
          <div className="workspace-tabs">
            <button
              className={`workspace-tab ${activeTab === "payroll" ? "active" : ""}`}
              onClick={() => setActiveTab("payroll")}
            >
              <span>💼 [1] Payroll Desk</span>
              <span className="tab-badge">{contractors.length}</span>
            </button>
            <button
              className={`workspace-tab ${activeTab === "contractor" ? "active" : ""}`}
              onClick={() => setActiveTab("contractor")}
            >
              <span>📥 [2] Contractor Inbox</span>
              <span className="tab-badge">{inboundHistory.length}</span>
            </button>
            <button
              className={`workspace-tab ${activeTab === "verify" ? "active" : ""}`}
              onClick={() => setActiveTab("verify")}
            >
              <span>🔍 [3] Audit Verifier</span>
              <span className="tab-badge">/verify</span>
            </button>
            <button
              className={`workspace-tab ${activeTab === "stealth" ? "active" : ""}`}
              onClick={() => setActiveTab("stealth")}
            >
              <span>[4] Stealth Burners (Devnet v1)</span>
              <span className="tab-badge">{network === "devnet" ? "devnet" : "locked"}</span>
            </button>
          </div>

          {/* TAB 1: PAYROLL DESK */}
          {activeTab === "payroll" && (
            <div>
              <div className="card-specular table-panel">
                <div className="table-header-row">
                  <div>
                    <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                      Batch Payroll Configuration
                    </h2>
                    <p className="muted" style={{ fontSize: "0.8rem" }}>
                      Execute confidential payroll across multiple contractors in a single Groth16 zero-knowledge proof.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    {/* Asset Pill Toggle: SOL | USDC */}
                    <div className="asset-pill-group">
                      <button
                        type="button"
                        className={`asset-pill-btn ${selectedAsset === "SOL" ? "active-sol" : ""}`}
                        onClick={() => handleSelectAsset("SOL")}
                        title="Switch to Native Solana (SOL)"
                      >
                        <span className="asset-badge asset-badge-sol">◎</span>
                        <span>SOL</span>
                      </button>
                      <button
                        type="button"
                        className={`asset-pill-btn ${selectedAsset === "USDC" ? "active-usdc" : ""}`}
                        onClick={() => handleSelectAsset("USDC")}
                        title="Switch to Confidential USDC (SPL Token)"
                      >
                        <span className="asset-badge asset-badge-usdc">$</span>
                        <span>USDC</span>
                      </button>
                    </div>

                    {/* Public vs Shielded Toggle */}
                    <button
                      type="button"
                      className={`btn btn-sm ${solscanPreview ? "btn-outline-emerald" : "btn-secondary"}`}
                      onClick={() => setSolscanPreview(!solscanPreview)}
                      title="Preview how onchain observers and Solscan view this table"
                    >
                      {solscanPreview ? "🕶️ Solscan View (Encrypted)" : "👁️ Employer View (Disclosed)"}
                    </button>

                    <button
                      className="btn btn-outline-emerald btn-sm"
                      onClick={() => setContractors(selectedAsset === "USDC" ? SAMPLE_CONTRACTORS_USDC : SAMPLE_CONTRACTORS_SOL)}
                      title={`Load 3 registered Devnet accounts with sample ${selectedAsset} amounts`}
                    >
                      ⚡ Load 3-Contractor Sample
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowCsvModal(true)}>
                      📋 Paste CSV
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={addContractorRow}>
                      + Add Contractor
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setContractors([])}>
                      Clear
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="payroll-table-wrap">
                  <table className="payroll-table">
                    <thead>
                      <tr>
                        <th style={{ width: "42%" }}>Recipient Solana Address</th>
                        <th style={{ width: "20%" }}>Amount ({selectedAsset})</th>
                        <th style={{ width: "32%" }}>Role / Memo</th>
                        <th style={{ width: "6%" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractors.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}>
                            No contractors added. Click "+ Add Contractor", "Paste CSV", or "Load 3-Contractor Sample".
                          </td>
                        </tr>
                      ) : (
                        contractors.map((c, i) => (
                          <tr key={i}>
                            <td>
                              <input
                                className="table-input"
                                placeholder="Solana Address (e.g. B5BQmV…gro)"
                                value={c.recipient}
                                onChange={(e) => updateContractor(i, "recipient", e.target.value)}
                              />
                            </td>
                            <td>
                              {solscanPreview ? (
                                <span className="cipher-block">
                                  0x{((i + 1) * 314159).toString(16).padEnd(6, "f")}•••• [ENCRYPTED]
                                </span>
                              ) : (
                                <input
                                  className="table-input"
                                  type="number"
                                  step={selectedAsset === "USDC" ? "1" : "0.001"}
                                  min={selectedAsset === "USDC" ? "0.01" : "0.0001"}
                                  placeholder={selectedAsset === "USDC" ? "1000" : "0.001"}
                                  value={c.amountSol ?? c.amount ?? ""}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    updateContractor(i, "amountSol", val);
                                    updateContractor(i, "amount" as any, val);
                                  }}
                                />
                              )}
                            </td>
                            <td>
                              <input
                                className="table-input"
                                placeholder="Role / Memo (e.g. Lead Engineer)"
                                value={c.memo}
                                onChange={(e) => updateContractor(i, "memo", e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "0.2rem 0.4rem", color: "var(--text-muted)" }}
                                onClick={() => removeContractor(i)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Payroll Summary Strip */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem", background: "var(--bg-input)", padding: "1rem", borderRadius: "0.625rem", border: "1px solid var(--border-card)", marginBottom: "1.25rem" }}>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Payroll</span>
                    <div className="mono" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{totalPayrollStr}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Ciphra Fee (0.50%)</span>
                    <div className="mono" style={{ fontWeight: 700, color: "#34D399" }}>{ciphraFeeStr}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Shielded Required</span>
                    <div className="mono" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{totalRequiredStr}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Groth16 Proofs</span>
                    <div className="mono" style={{ fontWeight: 700, color: "var(--cyan-primary)" }}>
                      {chunksNeeded} Proof{chunksNeeded > 1 ? "s" : ""} (≤14/chunk)
                    </div>
                  </div>
                </div>

                {/* Timing Jitter Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-card)", padding: "0.75rem 1rem", borderRadius: "0.625rem", marginBottom: "1.5rem" }}>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>⏱️ Anti-Correlation Mode (Staggered Timing Jitter)</div>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      Injects randomized 2s–6s intervals between payout batches to reduce timing-pattern correlation & temporal clustering.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    style={{ width: "1.1rem", height: "1.1rem", accentColor: "var(--emerald-primary)", cursor: "pointer" }}
                    checked={antiCorrelationJitter}
                    onChange={(e) => setAntiCorrelationJitter(e.target.checked)}
                  />
                </div>

                {/* Execute Button */}
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "0.85rem", fontSize: "1rem" }}
                  disabled={busy || contractors.length === 0}
                  onClick={handleExecutePayroll}
                >
                  {busy ? `Generating In-Browser ${selectedAsset} ZK Proof…` : `Execute Confidential ${selectedAsset} Payroll (${totalPayrollStr})`}
                </button>
              </div>

              {/* Recent Payroll Runs (Audit Ledger) */}
              <div className="card-specular table-panel">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Recent Payroll Runs (Audit Ledger)</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem" }}>
                      <input
                        type="checkbox"
                        checked={persistPayrollHistory}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setPersistPayrollHistory(enabled);
                          if (enabled) {
                            localStorage.setItem(PERSIST_PAYROLL_HISTORY_KEY, "1");
                            localStorage.setItem(RECENT_PAYROLL_RUNS_KEY, JSON.stringify(recentPayrollRuns));
                            setHistoryNotice("Payroll receipts will stay in this browser until you wipe them.");
                          } else {
                            localStorage.removeItem(PERSIST_PAYROLL_HISTORY_KEY);
                            localStorage.removeItem(RECENT_PAYROLL_RUNS_KEY);
                            localStorage.removeItem("veilpay_recent_runs");
                            setHistoryNotice("Payroll receipts stay in this tab only.");
                          }
                        }}
                      />
                      Keep receipts in this browser
                    </label>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => {
                        const { keptInFlightRuns } = wipeLocalPayrollHistory();
                        localStorage.removeItem(PERSIST_PAYROLL_HISTORY_KEY);
                        setPersistPayrollHistory(false);
                        setRecentPayrollRuns([]);
                        setHistoryNotice(
                          keptInFlightRuns > 0
                            ? `Wiped local payroll history. ${keptInFlightRuns} in-flight journal run${keptInFlightRuns === 1 ? "" : "s"} kept so a submitted transaction is not sent twice.`
                            : "Wiped local payroll history.",
                        );
                      }}
                    >
                      Wipe Local History
                    </button>
                    <span className="muted" style={{ fontSize: "0.75rem" }}>{recentPayrollRuns.length} in this session</span>
                  </div>
                </div>
                {historyNotice && (
                  <p className="muted" style={{ fontSize: "0.75rem", marginBottom: "0.75rem" }}>{historyNotice}</p>
                )}

                {recentPayrollRuns.length === 0 ? (
                  <p className="muted" style={{ fontSize: "0.85rem", textAlign: "center", padding: "2rem" }}>
                    No payroll batches executed yet. Run a payroll batch above to generate cryptographic audit receipts.
                  </p>
                ) : (
                  <div className="payroll-table-wrap">
                    <table className="payroll-table">
                      <thead>
                        <tr>
                          <th>Batch ID</th>
                          <th>Tx Signature</th>
                          <th>Slot</th>
                          <th>Disbursed</th>
                          <th>Contractors</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentPayrollRuns.map((r) => {
                          const chunk = r.chunks[0];
                          const txSig = chunk?.txSignature ?? "";
                          const slot = chunk?.slot ?? "";
                          const allPayouts = r.chunks.flatMap((chk) => chk.payouts);
                          return (
                            <tr key={r.id}>
                              <td className="mono" style={{ fontSize: "0.8rem" }}>{r.id.slice(0, 16)}…</td>
                              <td>
                                <a
                                  href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mono"
                                  style={{ color: "var(--cyan-primary)", fontSize: "0.8rem", textDecoration: "none" }}
                                >
                                  {txSig.slice(0, 8)}…{txSig.slice(-6)} ↗
                                </a>
                              </td>
                              <td className="mono" style={{ fontSize: "0.8rem" }}>#{slot}</td>
                              <td className="mono" style={{ color: r.asset === "USDC" ? "#60A5FA" : "#34D399", fontWeight: 600 }}>
                                {formatSol(r.totalPayroll ?? r.totalPayrollSol)} {r.asset || "SOL"}
                              </td>
                              <td>{allPayouts.length}</td>
                              <td style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setSelectedRunDetail(r)}
                                    title="View individual payouts & export single receipts"
                                  >
                                    View Payouts
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => exportCpaCsv(r)}
                                    title="Download CPA / Accounting Audit Spreadsheet (.csv)"
                                  >
                                    📊 Export CPA CSV
                                  </button>
                                  <button
                                    className="btn btn-outline-emerald btn-sm"
                                    onClick={() => downloadJson(`ciphra-batch-${r.asset || "SOL"}-${r.id}.json`, r)}
                                    title="Download Full Batch Receipt (.json)"
                                  >
                                    Download Batch JSON
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CONTRACTOR INBOX */}
          {activeTab === "contractor" && (
            <div className="card-specular table-panel">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                    Contractor Private Inbox
                  </h2>
                  <p className="muted" style={{ fontSize: "0.8rem" }}>
                    Encrypted UTXO receipts received by your shielded address. Withdraw funds back to public SOL or USDC anytime.
                  </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowUnshieldModal(true)}>
                  Unshield Funds
                </button>
              </div>

              {inboundHistory.length === 0 ? (
                <p className="muted" style={{ textAlign: "center", padding: "3rem", fontSize: "0.85rem" }}>
                  No incoming shielded transfers recorded on Devnet yet.
                </p>
              ) : (
                <div className="payroll-table-wrap">
                  <table className="payroll-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Direction</th>
                        <th>Slot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inboundHistory.map((h, i) => {
                        const isUsdc = h.asset === USDC_MINT;
                        const assetSymbol = isUsdc ? "USDC" : "SOL";
                        const decimals = isUsdc ? 6 : 9;
                        const formattedAmt = `${formatAmount(h.amount, decimals)} ${assetSymbol}`;
                        return (
                          <tr key={i}>
                            <td>{h.kind === "deposit" ? `Shielded ${assetSymbol} Deposit` : `Confidential ${assetSymbol} Payout`}</td>
                            <td className="mono" style={{ color: isUsdc ? "#60A5FA" : "#34D399", fontWeight: 600 }}>
                              {formattedAmt}
                            </td>
                            <td>
                              <span className="brand-pill" style={{ fontSize: "0.65rem" }}>INBOUND</span>
                            </td>
                            <td className="mono" style={{ fontSize: "0.8rem" }}>#{h.id?.slot?.toString() ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AUDIT VERIFIER */}
          {activeTab === "verify" && verifyView}

          {/* TAB 4: STEALTH BURNERS */}
          {activeTab === "stealth" && (
            <div className="card-specular table-panel">
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                Stealth Burners (Devnet v1)
              </h2>
              <p style={{ fontSize: "0.825rem", lineHeight: 1.5, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                {relayerNotice} Small ring sizes, plus timing and amount correlation, can still trace a burner back to this wallet. The burner key is a non-extractable key held in this tab&apos;s memory. Spawn, rotate, sweep, and wipe never write it to localStorage or sessionStorage. Mainnet stays locked unless VITE_ENABLE_MAINNET=true.
              </p>
              <p className="mono" style={{ fontSize: "0.75rem", marginBottom: "1rem" }}>
                {relayerPubkey === undefined ? "Relayer fee-payer: fallback (connected wallet)" : `Relayer fee-payer: ${relayerPubkey}`}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const previous = burner?.address;
                    void (async () => {
                      try {
                        const next = await createEphemeralBurner(network, network === "mainnet");
                        setBurner(next);
                        setSwapQuote(undefined);
                        setBurnerNote(previous === undefined
                          ? `Spawned ${next.address}. The key is only in memory.`
                          : `Rotated. Dropped ${previous} from memory. Funds still on that address are stranded.`);
                      } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : String(err));
                      }
                    })();
                  }}
                >
                  {burner === undefined ? "Spawn Disposable Burner" : "Rotate Disposable Burner"}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  disabled={busy || burner === undefined}
                  onClick={() => {
                    if (burner === undefined) return;
                    wipeEphemeralBurner(burner);
                    setBurner(undefined);
                    setSwapQuote(undefined);
                    setBurnerNote("Burner key reference dropped. It was not stored in the browser.");
                  }}
                >
                  Wipe Burner Key
                </button>
              </div>
              <p className="mono" style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>
                {burner === undefined ? "No burner in memory." : burner.address}
              </p>
              {burnerNote !== "" && (
                <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>{burnerNote}</p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
                <div className="asset-pill-group">
                  <button type="button" className={`asset-pill-btn ${burnerAsset === "SOL" ? "active-sol" : ""}`} onClick={() => { setBurnerAsset("SOL"); setSwapQuote(undefined); }}>SOL</button>
                  <button type="button" className={`asset-pill-btn ${burnerAsset === "USDC" ? "active-usdc" : ""}`} onClick={() => { setBurnerAsset("USDC"); setSwapQuote(undefined); }}>USDC</button>
                </div>
                <input
                  className="table-input"
                  style={{ maxWidth: "10rem" }}
                  value={burnerAmount}
                  onChange={(event) => { setBurnerAmount(event.target.value); setSwapQuote(undefined); }}
                  inputMode="decimal"
                />
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Cap {formatAmount(stealthUnshieldCap(burnerAsset), ASSETS[burnerAsset].decimals)} {burnerAsset}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={busy || session === undefined || burner === undefined}
                  onClick={() => {
                    if (session === undefined || burner === undefined) return;
                    let parsed: bigint;
                    try {
                      parsed = parseAmount(burnerAmount, ASSETS[burnerAsset].decimals);
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : String(err));
                      return;
                    }
                    const recipient = burner.address;
                    void run(`Unshield ${burnerAmount} ${burnerAsset} to burner`, (active) =>
                      actions.unshieldToRecipient(active, recipient, parsed, ASSETS[burnerAsset].mint),
                    );
                  }}
                >
                  Unshield capped {burnerAsset} to Burner
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  disabled={burnerAmount.trim() === "" || (liveJupiter && (session === undefined || burner === undefined))}
                  onClick={() => {
                    const currentSession = session;
                    const currentBurner = burner;
                    const jupiterConfig = {
                      networkName: network,
                      ...(import.meta.env.VITE_ENABLE_LIVE_JUPITER === undefined
                        ? {}
                        : { liveJupiterFlag: import.meta.env.VITE_ENABLE_LIVE_JUPITER }),
                      ...(import.meta.env.VITE_FEE_ATA_WSOL === undefined
                        ? {}
                        : { wsolAta: import.meta.env.VITE_FEE_ATA_WSOL }),
                      ...(import.meta.env.VITE_FEE_ATA_USDC === undefined
                        ? {}
                        : { usdcAta: import.meta.env.VITE_FEE_ATA_USDC }),
                    };
                    void (async () => {
                      setError("");
                      try {
                        const requested = parseAmount(burnerAmount, ASSETS[burnerAsset].decimals);
                        let burnerBalance = stealthUnshieldCap(burnerAsset);
                        if (currentSession !== undefined && currentBurner !== undefined) {
                          if (burnerAsset === "SOL") {
                            burnerBalance = (await currentSession.client.solanaRpc.getBalance(currentBurner.address).send()).value;
                          } else {
                            const mint = address(liveJupiter ? JUPITER_USDC_MINT : ASSETS.USDC.mint);
                            const ata = await getAssociatedTokenAddress(currentBurner.address, mint);
                            try {
                              const token = await currentSession.client.solanaRpc.getTokenAccountBalance(ata).send();
                              burnerBalance = BigInt(token.value.amount);
                            } catch {
                              burnerBalance = 0n;
                            }
                          }
                        }
                        const amount = clampStealthSwapAmount({
                          requested,
                          burnerBalance,
                          networkName: network,
                          asset: burnerAsset,
                        });
                        const output: AssetSymbol = burnerAsset === "SOL" ? "USDC" : "SOL";
                        if (!liveJupiter) {
                          setSwapQuote(quoteStealthBurnerSwapStub(
                            network,
                            amount,
                            ASSETS[burnerAsset].mint,
                            ASSETS[output].mint,
                          ));
                          return;
                        }
                        if (currentSession === undefined || currentBurner === undefined) {
                          throw new Error("Spawn a burner and connect a wallet before a live swap.");
                        }
                        setBusy(true);
                        const inputMint = burnerAsset === "SOL" ? WSOL_MINT : JUPITER_USDC_MINT;
                        const outputMint = output === "SOL" ? WSOL_MINT : JUPITER_USDC_MINT;
                        const quote = await quoteLiveJupiterSwap(network, amount, inputMint, outputMint, jupiterConfig);
                        const result = await executeStealthBurnerSwap(currentBurner, quote, {
                          send: (wire) => currentSession.client.solanaRpc.sendTransaction(wire, { encoding: "base64" }).send(),
                        }, jupiterConfig);
                        setBurnerNote(`Jupiter swap submitted. ${result.signature}`);
                      } catch (err: unknown) {
                        setSwapQuote(undefined);
                        setError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  {liveJupiter ? "Swap on Jupiter + 0.50% Fee" : "Preview Swap + 0.50% Fee Hook"}
                </button>
                <button
                  className="btn btn-outline-emerald btn-sm"
                  type="button"
                  disabled={busy || session === undefined || burner === undefined}
                  onClick={() => {
                    if (session === undefined || burner === undefined) return;
                    const current = burner;
                    void (async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const result = await sweepBurnerToShield(session, current, burnerAsset);
                        setBurner(undefined);
                        setSwapQuote(undefined);
                        setBurnerNote(`Swept ${burnerAsset} back to the shielded address. ${result.signature}`);
                        setState(await snapshot(session, result.slot));
                      } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Sweep Back to Shield
                </button>
              </div>
              {swapQuote !== undefined && (
                <div style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
                  <div>Route: {swapQuote.route}</div>
                  <div>Input: {formatAmount(BigInt(swapQuote.amountBaseUnits), ASSETS[burnerAsset].decimals)} {burnerAsset}</div>
                  <div>Platform fee ({(swapQuote.feeBps / 100).toFixed(2)}%): {formatAmount(BigInt(swapQuote.platformFeeBaseUnits), ASSETS[burnerAsset].decimals)} {burnerAsset}</div>
                  <div>Net swap amount: {formatAmount(BigInt(swapQuote.netSwapAmountBaseUnits), ASSETS[burnerAsset].decimals)} {burnerAsset}</div>
                  <p className="muted" style={{ marginTop: "0.35rem" }}>{swapQuote.note}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========================================================
          MODALS & OVERLAYS
          ======================================================== */}

      {/* 4-STAGE ANIMATED ZK PROOF STEPPER OVERLAY */}
      {busy && payrollProgress !== "" && (
        <div className="stepper-overlay">
          <div className="stepper-card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div className="spinner" style={{ width: "1.5rem", height: "1.5rem" }} />
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Executing Confidential {selectedAsset} Payroll</h3>
            </div>
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              {payrollProgress}
            </p>

            <div className="stepper-steps">
              <div className={`stepper-step ${proofStage > 1 ? "done" : proofStage === 1 ? "active" : ""}`}>
                <div className="step-indicator">{proofStage > 1 ? "✓" : "1"}</div>
                <div className="step-info">
                  <span className="step-title">Selecting Shielded UTXOs</span>
                  <span className="step-desc">Identifying unspent {selectedAsset} notes from private treasury & nullifiers</span>
                </div>
              </div>

              <div className={`stepper-step ${proofStage > 2 ? "done" : proofStage === 2 ? "active" : ""}`}>
                <div className="step-indicator">{proofStage > 2 ? "✓" : "2"}</div>
                <div className="step-info">
                  <span className="step-title">Generating Browser Groth16 Proof</span>
                  <span className="step-desc">WASM prover computing {selectedAsset} multi-transfer zk-SNARK witness</span>
                </div>
              </div>

              <div className={`stepper-step ${proofStage > 3 ? "done" : proofStage === 3 ? "active" : ""}`}>
                <div className="step-indicator">{proofStage > 3 ? "✓" : "3"}</div>
                <div className="step-info">
                  <span className="step-title">Anti-Correlation Timing Jitter</span>
                  <span className="step-desc">Staggered delay to disrupt on-chain temporal graph analysis</span>
                </div>
              </div>

              <div className={`stepper-step ${proofStage === 4 ? "active" : ""}`}>
                <div className="step-indicator">{proofStage === 4 ? "✓" : "4"}</div>
                <div className="step-info">
                  <span className="step-title">Finalized on Solana {networkLabel}</span>
                  <span className="step-desc">Confirming the transaction slot on the Solana RPC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: BATCH RUN INDIVIDUAL CONTRACTOR RECEIPTS */}
      {selectedRunDetail && (
        <div className="modal-overlay" onClick={() => setSelectedRunDetail(null)}>
          <div className="modal-content" style={{ maxWidth: "40rem" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <h3 className="modal-title">Batch Payouts: {selectedRunDetail.id.slice(0, 16)}…</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedRunDetail(null)}>✕</button>
            </div>
            <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
              Export selective disclosure tax receipts for individual contractors without disclosing other salaries.
            </p>

            <div className="payroll-table-wrap" style={{ maxHeight: "16rem", overflowY: "auto" }}>
              <table className="payroll-table">
                <thead>
                  <tr>
                    <th>Contractor</th>
                    <th>Amount ({selectedRunDetail.asset || "SOL"})</th>
                    <th>Memo</th>
                    <th style={{ textAlign: "right" }}>Single Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRunDetail.chunks.flatMap((chk) => chk.payouts).map((p, idx) => (
                    <tr key={idx}>
                      <td className="mono" style={{ fontSize: "0.8rem" }}>{p.recipient.slice(0, 6)}…{p.recipient.slice(-6)}</td>
                      <td className="mono" style={{ color: selectedRunDetail.asset === "USDC" ? "#60A5FA" : "#34D399", fontWeight: 600 }}>
                        {formatSol(p.amount ?? p.amountSol ?? 0)} {selectedRunDetail.asset || "SOL"}
                      </td>
                      <td>{p.memo}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-outline-emerald btn-sm"
                          style={{ fontSize: "0.7rem", padding: "0.2rem 0.45rem" }}
                          onClick={() => exportSingleContractorReceipt(selectedRunDetail, p)}
                        >
                          📄 Export JSON
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button className="btn btn-secondary" onClick={() => setSelectedRunDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PASTE CSV */}
      {showCsvModal && (
        <div className="modal-overlay" onClick={() => setShowCsvModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Import Recipients via CSV</h3>
            <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
              Format: <code>solana_address, amount_{selectedAsset.toLowerCase()}, role_memo</code> (one per line).
            </p>
            <textarea
              className="csv-textarea"
              placeholder={
                selectedAsset === "USDC"
                  ? `B5BQmVv7tjCBaHm8TwLdgY5jKxXpU14gptEspTouKgro, 4500, Lead Rust Engineer\nB9NFbnL3DV1DVvC89t1G5gcmzZ9e4g2dqN4VwcdwvnxR, 6000, ZK Prover Specialist`
                  : `B5BQmVv7tjCBaHm8TwLdgY5jKxXpU14gptEspTouKgro, 0.001, Lead Rust Engineer\nB9NFbnL3DV1DVvC89t1G5gcmzZ9e4g2dqN4VwcdwvnxR, 0.0015, ZK Prover Specialist`
              }
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn btn-secondary" onClick={() => setShowCsvModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={parseCsvData}>Import Rows</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHIELD SOL / USDC */}
      {showShieldModal && (
        <div className="modal-overlay" onClick={() => setShowShieldModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Deposit / Shield Public {selectedAsset}</h3>
            <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
              Moves {selectedAsset} from your public Solana wallet into confidential zero-knowledge UTXO notes on Solana Privacy Rings.
            </p>

            {selectedAsset === "USDC" && currentAssetData.publicUnits === 0n && (
              <div style={{ background: "rgba(37, 99, 235, 0.1)", border: "1px solid rgba(96, 165, 250, 0.3)", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.8rem", color: "#93C5FD", marginBottom: "0.5rem" }}>
                  ℹ️ <strong>Devnet Test USDC ATA is Empty (0 USDC).</strong>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => {
                      void run("Mint 10,000 Test Devnet USDC", (s) => actions.mintDevnetTestUsdc(s, 10000));
                    }}
                  >
                    ⚡ Mint 10,000 Test Devnet USDC (1-Click)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyToClipboard(USDC_MINT.toString(), "mint")}
                  >
                    {copiedText === "mint" ? "Copied Mint!" : "📋 Copy Mint"}
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span className="telemetry-label">Amount to Shield ({selectedAsset})</span>
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Available Public: {formattedPublic}
                </span>
              </div>
              <input
                className="table-input"
                type="number"
                step={selectedAsset === "USDC" ? "1" : "0.01"}
                min={selectedAsset === "USDC" ? "0.1" : "0.001"}
                value={shieldAmount}
                onChange={(e) => setShieldAmount(e.target.value)}
              />
              <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                {(selectedAsset === "USDC" ? ["25", "50", "100", "500"] : ["0.01", "0.02", "0.05", "0.1"]).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "0.15rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => setShieldAmount(amt)}
                  >
                    {amt} {selectedAsset}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button className="btn btn-secondary" onClick={() => setShowShieldModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={busy || !shieldAmount || parseFloat(shieldAmount) <= 0}
                onClick={() => {
                  setShowShieldModal(false);
                  const parsedUnits = parseAmount(shieldAmount, currentAssetConfig.decimals);
                  void run(`Deposit / Shield ${shieldAmount} ${selectedAsset}`, (s) =>
                    actions.deposit(s, parsedUnits, currentAssetConfig.mint)
                  );
                }}
              >
                {busy ? "Confirming on Devnet…" : `Confirm Shield ${selectedAsset}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UNSHIELD SOL / USDC */}
      {showUnshieldModal && (
        <div className="modal-overlay" onClick={() => setShowUnshieldModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Unshield / Withdraw {selectedAsset}</h3>
            <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
              Withdraw private shielded {selectedAsset} back to your public Solana wallet.
            </p>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span className="telemetry-label">Amount to Unshield ({selectedAsset})</span>
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Private Balance: {formattedPrivate} (Spend Limit: {formattedSpendLimit})
                </span>
              </div>
              <input
                className="table-input"
                type="number"
                step={selectedAsset === "USDC" ? "1" : "0.001"}
                min={selectedAsset === "USDC" ? "0.01" : "0.0001"}
                value={unshieldAmount}
                onChange={(e) => setUnshieldAmount(e.target.value)}
              />
              <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                {(selectedAsset === "USDC" ? ["10", "25", "50", "100"] : ["0.001", "0.005", "0.01"]).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "0.15rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => setUnshieldAmount(amt)}
                  >
                    {amt} {selectedAsset}
                  </button>
                ))}
                {currentAssetData.privateUnits > 0n && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "0.15rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => setUnshieldAmount(formatAmount(currentAssetData.localSpendLimit, currentAssetConfig.decimals))}
                  >
                    Max Spendable
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button className="btn btn-secondary" onClick={() => setShowUnshieldModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={busy || !unshieldAmount || parseFloat(unshieldAmount) <= 0}
                onClick={() => {
                  setShowUnshieldModal(false);
                  const parsedUnits = parseAmount(unshieldAmount, currentAssetConfig.decimals);
                  void run(`Unshield / Withdraw ${unshieldAmount} ${selectedAsset}`, (s) =>
                    actions.withdraw(s, parsedUnits, currentAssetConfig.mint)
                  );
                }}
              >
                {busy ? "Proving & Withdrawing…" : `Confirm Unshield ${selectedAsset}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONNECT EXTERNAL WALLET (PHANTOM / SOLFLARE / DEMO PAYER) */}
      {showWalletModal && (
        <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "28rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Connect Solana Wallet</h3>
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: "0.2rem 0.5rem" }}
                onClick={() => setShowWalletModal(false)}
              >
                ✕
              </button>
            </div>
            <p className="muted" style={{ fontSize: "0.8rem", marginBottom: "1.25rem" }}>
              Connect your browser wallet to prove and sign confidential payroll with your own Solana address, or test with our pre-funded 9.98 SOL Devnet account.
            </p>

            {walletError && (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "1rem", color: "#FCA5A5", fontSize: "0.8rem" }}>
                {walletError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {/* Phantom Button */}
              <button
                type="button"
                className="wallet-option-btn"
                disabled={walletConnecting}
                onClick={() => void handleConnectWallet("phantom")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.25rem" }}>🟣</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700 }}>Phantom Wallet</div>
                    <div style={{ fontSize: "0.725rem", color: "var(--text-secondary)" }}>
                      Solana browser extension
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {walletConnecting ? "Connecting…" : "Connect →"}
                </span>
              </button>

              {/* Solflare Button */}
              <button
                type="button"
                className="wallet-option-btn"
                disabled={walletConnecting}
                onClick={() => void handleConnectWallet("solflare")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.25rem" }}>🟠</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700 }}>Solflare Wallet</div>
                    <div style={{ fontSize: "0.725rem", color: "var(--text-secondary)" }}>
                      Solana web & hardware extension
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {walletConnecting ? "Connecting…" : "Connect →"}
                </span>
              </button>

              <div style={{ margin: "0.75rem 0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ flex: 1, height: "1px", background: "var(--border-card)" }} />
                <span style={{ fontSize: "0.675rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Or Instant Demo Testing
                </span>
                <div style={{ flex: 1, height: "1px", background: "var(--border-card)" }} />
              </div>

              {/* Demo Mode Button */}
              <button
                type="button"
                className="wallet-option-btn"
                disabled={!hasFundedDevnetPayer()}
                style={{
                  borderColor: hasFundedDevnetPayer() ? "rgba(16, 185, 129, 0.35)" : "rgba(255, 255, 255, 0.08)",
                  background: hasFundedDevnetPayer() ? "rgba(16, 185, 129, 0.05)" : "rgba(255, 255, 255, 0.02)",
                  opacity: hasFundedDevnetPayer() ? 1 : 0.6,
                }}
                onClick={() => {
                  if (hasFundedDevnetPayer()) {
                    loadFundedDevnetSeed(network);
                    setShowWalletModal(false);
                    location.reload();
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.25rem" }}>⚡</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, color: hasFundedDevnetPayer() ? "#34D399" : "var(--text-secondary)" }}>
                      Demo Mode (Funded Devnet Payer)
                    </div>
                    <div style={{ fontSize: "0.725rem", color: "var(--text-secondary)" }}>
                      {hasFundedDevnetPayer()
                        ? "9.98 SOL + 100k test USDC loaded · 0 wallet setup needed"
                        : "No funded key in environment — use Phantom/Solflare or generate burner"}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: "0.8rem", color: hasFundedDevnetPayer() ? "#34D399" : "var(--text-muted)" }}>
                  {hasFundedDevnetPayer() ? (!activeWalletInfo.isExternal ? "Active" : "Switch →") : "Unavailable"}
                </span>
              </button>

              {/* Reset Ephemeral Key */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: "0.5rem" }}
                onClick={() => {
                  resetBurner(network);
                  setShowWalletModal(false);
                  location.reload();
                }}
              >
                🔄 Generate Fresh Ephemeral Keypair
              </button>

              {/* Disconnect Option if External Wallet is Connected */}
              {activeWalletInfo.isExternal && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: "#F87171", borderColor: "rgba(239, 68, 68, 0.3)", marginTop: "0.25rem" }}
                  onClick={handleDisconnectWallet}
                >
                  Disconnect {activeWalletInfo.name}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Prover Status */}
      <footer style={{ marginTop: "4rem", textAlign: "center", borderTop: "1px solid var(--border-card)", paddingTop: "1.25rem", paddingBottom: "2rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", padding: "0.25rem 0.75rem", borderRadius: "9999px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          <span>🛡️</span>
          <span>Built on Solana Privacy Rings (@heliuslabs/spr) · Groth16 proofs in the browser</span>
        </div>
        <p className="muted" style={{ fontSize: "0.75rem" }}>
          Ciphra Powered by Solana Privacy Rings & Helius TEE Attested Prover · {keys}
        </p>
      </footer>
    </main>
  );
}

function keyStatus({ keyFile, stage, loaded, total }: KeyProgress): string {
  if (stage === "decode") return `Decoding ${keyFile}…`;
  return `Downloading ${keyFile}: ${String(Math.floor((100 * loaded) / total))}%`;
}
