# Ciphra

Devnet demo of a payroll app on Solana Privacy Rings (`@heliuslabs/spr`).

It submits shielded transfers with `buildMultiTransferTransaction`. That proof hides amounts, not recipients. Hiding recipient addresses requires Custom Rings, which are still in audit. The fee-paying Solana account is still the transaction signer.

`/verify` checks a receipt against decrypted notes. Zero decrypted notes are `FAILED`. A payout line without a shielded address is unsupported. Employer mode matches each output's viewing key and amount.

## Limitations

- Devnet demo only. The mainnet path is untested. Do not send production funds.
- Recipients stay visible. The Helius Default Ring hides amounts, not recipient addresses. Hiding recipient addresses requires Custom Rings, which are still in audit.
- Single signer. Multisig and Squads are not supported yet. That is on the roadmap.
- Alpha SDK: `@heliuslabs/spr@0.9.0-alpha`.
- The first load is slow. The browser downloads the prover WASM and the proving keys before a payroll proof can run.

## Run locally

```bash
npm ci
npm run build:prover
npm run dev --workspace @zolana/wallet-example
```

Open `http://127.0.0.1:5179/`. Copy `examples/wallet/.env.example` to `examples/wallet/.env.local` and set a devnet Helius key if you need one. Every `VITE_*` value is compiled into the public bundle. Do not put a private key or an unrestricted API key there. Leave `VITE_FUNDED_KEYPAIR` unset.

## License

Apache-2.0. Built on Solana Privacy Rings by Helius Labs.
