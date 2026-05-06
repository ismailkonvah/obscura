# Obscura Arcium Program Scaffold

This folder documents the Solana + Arcium program shape for the hackathon submission.

The frontend is already wired to Solana devnet wallets and `@arcium-hq/client`. The remaining deployment work is to generate the Arcis/Anchor program with the Arcium CLI, deploy it to devnet, and point `VITE_ARCIUM_MXE_PROGRAM_ID` at the deployed MXE.

## Confidential Instruction

The core computation is `resolve_blind_auction`:

- Inputs: encrypted bid records.
- Public parameters: lot id, close slot, auction format, unit count.
- Private computation: compare bid amounts, determine winners, compute first-price, second-price, or uniform clearing price.
- Revealed output: winning bidder commitments, clearing price, and allocations.
- Hidden forever: losing bid amounts and non-winning bidder strategy.

## Deployment Sketch

```bash
arcium init obscura_auctions
arcium build
arcium deploy \
  --cluster-offset 456 \
  --recovery-set-size 4 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url https://api.devnet.solana.com
```

After deployment:

```bash
set VITE_ARCIUM_MXE_PROGRAM_ID=<DEPLOYED_MXE_PROGRAM_ID>
set VITE_ARCIUM_MXE_PUBLIC_KEY=<DEPLOYED_MXE_PUBLIC_KEY>
npm run build
```

## Why Not Reveal All Bids?

For sealed-bid, Vickrey, and uniform-price auctions, the bids are the sensitive data. Arcium keeps those values encrypted while computing the auction result, which removes the main source of collusion and MEV leakage.
