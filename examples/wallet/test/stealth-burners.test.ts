import assert from "node:assert/strict";
import { test } from "node:test";
import {
  JUPITER_USDC_MINT,
  STEALTH_BURNER_FEE_BPS,
  WSOL_MINT,
  calculateStealthFee,
  clampStealthSwapAmount,
  createEphemeralBurner,
  liveJupiterEnabled,
  pickProtocolFeeCollector,
  quoteStealthBurnerSwapStub,
  selectJupiterFeeAccount,
  wipeEphemeralBurner,
} from "../src/stealthBurners.ts";

const SENDER = "CochByMjwdvZTWVPK4GqV3po66TmnjLvBxsC3wexTHQ1";
const TREASURY = "B5BQmVv7tjCBaHm8TwLdgY5jKxXpU14gptEspTouKgro";

test("stealth fee is 50 bps, truncated", () => {
  assert.equal(STEALTH_BURNER_FEE_BPS, 50);
  assert.equal(calculateStealthFee(1_000_000_000n, 50), 5_000_000n);
  assert.equal(calculateStealthFee(1n, 50), 0n);
  assert.equal(calculateStealthFee(0n, 50), 0n);
  assert.throws(() => calculateStealthFee(-1n, 50));
  assert.throws(() => calculateStealthFee(10n, 10_001));
});

test("swap stub deducts the 50 bps platform fee and refuses mainnet", () => {
  const quote = quoteStealthBurnerSwapStub("devnet", 2_000_000n, "SOL", "USDC");
  assert.equal(quote.network, "devnet");
  assert.equal(quote.route, "jupiter-devnet-stub");
  assert.equal(quote.feeBps, 50);
  assert.equal(quote.platformFeeBaseUnits, "10000");
  assert.equal(quote.netSwapAmountBaseUnits, "1990000");
  assert.equal(BigInt(quote.platformFeeBaseUnits) + BigInt(quote.netSwapAmountBaseUnits), 2_000_000n);
  assert.throws(() => quoteStealthBurnerSwapStub("mainnet", 2_000_000n, "SOL", "USDC"), /devnet only/);
});

test("protocol fee collector does not fall back to the sender off devnet", () => {
  const isAddress = (value: string) => value.length >= 32;
  assert.equal(
    pickProtocolFeeCollector({
      networkName: "devnet",
      senderAddress: SENDER,
      envCollector: "",
      explicitIsAddress: isAddress,
    }),
    SENDER,
  );
  assert.equal(
    pickProtocolFeeCollector({
      networkName: "devnet",
      senderAddress: SENDER,
      envCollector: TREASURY,
      explicitIsAddress: isAddress,
    }),
    TREASURY,
  );
  assert.throws(
    () => pickProtocolFeeCollector({
      networkName: "mainnet",
      senderAddress: SENDER,
      explicitIsAddress: isAddress,
    }),
    /must not default to the connected wallet/,
  );
  assert.throws(
    () => pickProtocolFeeCollector({
      networkName: "mainnet",
      senderAddress: SENDER,
      explicit: SENDER,
      explicitIsAddress: isAddress,
    }),
    /must not default to the connected wallet/,
  );
  assert.equal(
    pickProtocolFeeCollector({
      networkName: "mainnet",
      senderAddress: SENDER,
      envCollector: TREASURY,
      explicitIsAddress: isAddress,
    }),
    TREASURY,
  );
});

test("jupiter fee account follows the WSOL or USDC side and rejects other pairs", () => {
  const wsolAta = "WsolFeeAccount11111111111111111111111111111111";
  const usdcAta = "UsdcFeeAccount1111111111111111111111111111111";
  assert.equal(selectJupiterFeeAccount({
    inputMint: JUPITER_USDC_MINT,
    outputMint: WSOL_MINT,
    wsolAta,
    usdcAta,
  }), wsolAta);
  assert.equal(selectJupiterFeeAccount({
    inputMint: WSOL_MINT,
    outputMint: JUPITER_USDC_MINT,
    wsolAta,
    usdcAta,
  }), usdcAta);
  assert.equal(selectJupiterFeeAccount({
    inputMint: WSOL_MINT,
    outputMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    wsolAta,
  }), wsolAta);
  assert.throws(
    () => selectJupiterFeeAccount({
      inputMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      outputMint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      wsolAta,
      usdcAta,
    }),
    /neither/,
  );
  assert.throws(
    () => selectJupiterFeeAccount({ inputMint: JUPITER_USDC_MINT, outputMint: WSOL_MINT }),
    /VITE_FEE_ATA_WSOL/,
  );
  assert.equal(liveJupiterEnabled("devnet", undefined), false);
  assert.equal(liveJupiterEnabled("devnet", "true"), true);
  assert.equal(liveJupiterEnabled("mainnet", undefined), true);
  assert.equal(clampStealthSwapAmount({
    requested: 1_000n,
    burnerBalance: 5_000n,
    networkName: "devnet",
    asset: "SOL",
  }), 1_000n);
  assert.throws(() => clampStealthSwapAmount({
    requested: 200_000_000n,
    burnerBalance: 500_000_000n,
    networkName: "devnet",
    asset: "SOL",
  }), /devnet cap/);
});

test("ephemeral burner stays in memory and is devnet-only", async () => {
  const storage = {
    setItem() {
      throw new Error("burner key was written to storage");
    },
    getItem() {
      return null;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: storage, configurable: true });
  await assert.rejects(() => createEphemeralBurner("mainnet"), /devnet only/);
  const first = await createEphemeralBurner("devnet");
  const second = await createEphemeralBurner("devnet");
  assert.notEqual(first.address, second.address);
  assert.equal(second.signer.address, second.address);
  wipeEphemeralBurner(second);
  assert.equal(typeof second.address, "string");
});
