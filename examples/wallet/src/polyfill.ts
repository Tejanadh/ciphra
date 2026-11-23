import { install } from "@solana/webcrypto-ed25519-polyfill";

// Polyfill Ed25519 for WebCrypto API (SubtleCrypto) in browsers lacking native support
install();
