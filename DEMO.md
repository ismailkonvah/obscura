# Obscura Demo Walkthrough

This walkthrough shows the recommended flow for the live devnet demo.

## Goal

Demonstrate a blind auction flow where bidders cannot react to each other before close:

- bid amounts stay hidden
- losing bid strategy stays hidden
- only winner, clearing price, and allocation are revealed on settlement
- Arcium encrypts bid payloads client-side, and sealed-bid or Vickrey settlement can use the deployed MXE on devnet

## Steps

1. Start the app.

```bash
npm install
npm run dev
```

2. Connect a Solana devnet wallet.

Use Phantom or Solflare. The app reads balance from the configured Solana devnet RPC.

3. Request devnet SOL.

Open the wallet menu and click `Request 1 devnet SOL`.

4. Prepare confidential bidding balance.

Open `/get-csol`, enter an amount, and wrap SOL into cSOL. The app transfers devnet SOL into a local demo vault, creates or reuses a real devnet SPL token mint, and mints the same amount as cSOL into your associated token account. You can withdraw by burning cSOL and receiving SOL back from the vault. In production this step becomes a program-owned vault or PDA plus the Arcium-backed token lock/encrypted balance flow.

5. Create a blind auction.

Open `/create-auction`, enter the item name, description, and image, then choose one of:

- Sealed-Bid
- Vickrey
- Uniform Price

Set a reserve in cSOL and close time, then create the auction. The app mints a one-of-one devnet SPL lot behind the scenes and opens the blind auction. The success screen gives you a shareable auction link.

6. Submit a private bid.

Open the created auction, enter a bid, and submit. The app uses `@arcium-hq/client` to create an encrypted payload with a client public key, nonce, ciphertext blocks, and commitment hash before recording the sealed bid. The bid amount is not shown in the public activity feed.

7. Resolve the auction.

If you created the auction, click `Settle auction`. For Sealed-Bid and Vickrey auctions, the app attempts the live Arcium MXE settlement path on devnet before falling back locally. The UI reveals the result and settlement actions only: winner, clearing price, seller payout, refunds, and lot transfer.

## Current Notes

- Sealed-Bid and Vickrey are the strongest live demo paths.
- Uniform Price is available in the product, but still falls back to local settlement logic.
- The current live Arcium settlement path supports up to 3 bids per auction.

## What This Flow Shows

Obscura is not a public ascending auction. It is a private price discovery market:

- no bid sniping before close
- no public mempool leakage of bid amounts
- no real-time copy-bidding
- no losing strategy disclosure

The deployed MXE is already wired into the frontend environment. The remaining protocol step is expanding live Arcium-backed settlement beyond the current Sealed-Bid and Vickrey path and removing the remaining local fallback paths.
