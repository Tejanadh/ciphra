/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_INDEXER_URL?: string;
  readonly VITE_HELIUS_API_KEY?: string;
  readonly VITE_PROTOCOL_FEE_COLLECTOR?: string;
  readonly VITE_ENABLE_MAINNET?: string;
  readonly VITE_ENABLE_LIVE_JUPITER?: string;
  readonly VITE_FEE_ATA_WSOL?: string;
  readonly VITE_FEE_ATA_USDC?: string;
}
