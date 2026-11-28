# Ciphra wallet

Devnet demo. The product notes live in the repository [README](../../README.md).

`buildMultiTransferTransaction` uses the Default Ring. The Default Ring hides amounts, not recipients. Hiding recipient addresses requires Custom Rings, which are still in audit.

## Limitations

- Devnet demo only. Do not send production funds.
- Amounts-only privacy. The Default Ring hides amounts, not recipients. Hiding recipient addresses requires Custom Rings, which are still in audit.
- Without a configured relayer, the connected wallet signs as the fee payer. A server relayer (`RELAYER_PRIVATE_KEY`, never `VITE_`) can pay unshield and sweep fees. Mainnet stays locked unless `VITE_ENABLE_MAINNET=true`.
