# Obscura Auctions

Blind auctions for Solana, designed for Arcium confidential computation.

Obscura supports sealed-bid, Vickrey, and uniform-price auction flows. The app connects to a real injected Solana wallet on devnet, reads wallet state from the configured devnet RPC, includes a devnet airdrop helper for testing, and provides an end-to-end demo marketplace flow: wrap SOL into 1:1 cSOL as a real devnet SPL token, withdraw SOL by burning cSOL, create an auction with a cSOL reserve and custom item metadata, mint a one-of-one devnet SPL lot automatically, submit private cSOL bids, and settle to the final result.

## Why Arcium

Blind auctions need bidders to commit without seeing or reacting to competing bids. A normal on-chain auction leaks bids immediately, which invites collusion, copy-bidding, and MEV.

Arcium solves the privacy problem by letting the application process encrypted inputs through MPC. In Obscura:

1. The bidder connects a Solana devnet wallet.
2. The client encrypts the bid amount with `@arcium-hq/client` using X25519 shared-secret setup and Arcium `RescueCipher`.
3. The deployed MXE program receives encrypted bid amounts, nonce, client public key, and commitment hash.
4. Arcium MPC nodes compute the result without revealing plaintext bids.
5. Only the result is revealed at close: winner, clearing price, and allocation.

Reference docs:

- Arcium developer overview: https://docs.arcium.com/developers
- Arcium TypeScript SDK: https://ts.arcium.com/docs
- Arcium program computation lifecycle: https://docs.arcium.com/developers/program

## Current Status

Implemented:

- React/TanStack frontend for live auction browsing and bidding UX.
- Real injected wallet connection for Phantom/Solflare-style Solana wallets.
- Devnet balance reads and `requestAirdrop` support.
- 1:1 cSOL devnet wrapper flow for confidential bidding UX: deposit SOL to a demo vault, mint cSOL, burn cSOL, and withdraw SOL.
- Custom lot creation inside the auction flow, one-of-one devnet SPL lot minting, private bid commitments, and owner-side resolution.
- Arcium SDK bid encryption: private bids are converted into ciphertext payloads before entering local demo state.
- Browser-safe Arcium integration metadata in `src/lib/arcium.ts`.
- Browser shims in `vite.config.ts` for the Arcium SDK's Node imports during client bundling.
- Protocol boundary in `src/lib/auctionProgramClient.ts` so local demo behavior can be swapped for the deployed Arcium/Anchor client.
- In-app Arcium explanation and integration status panel.
- Devnet MXE deployed at `EnPG3YjzUNpDgHp6YqiLoaeL5iNjaEHfXH9E1SYqpWEP`, with frontend env wired to the live MXE public key.
- Live Arcium devnet settlement attempt for Sealed-Bid and Vickrey auctions, with local fallback where the current protocol path is not yet implemented.

Remaining integration step:

- Expand live Arcium-backed settlement beyond the current Sealed-Bid and Vickrey flow.
- Remove the remaining local fallback logic used for Uniform Price and unsupported edge cases.
- Replace the browser-local demo vault key with a program-owned vault or PDA.

## Run

```bash
npm install
npm run dev
```

Open the local URL, connect a devnet wallet, and request devnet SOL from the wallet menu if needed.

For the judging walkthrough, see `DEMO.md`.

## Checks

```bash
npm run lint
npm run build
npm audit --audit-level=moderate
npm run arcium:status
```

`npm run lint` currently passes with Fast Refresh warnings from shared exports in UI/helper files.

## Submission Fit

Innovation: private price discovery for high-value digital and real-world assets.

Technical implementation: Solana devnet wallet integration, Arcium client integration layer, typed encrypted bid input model, and a deployed MXE program with live Sealed-Bid and Vickrey settlement attempts on devnet.

User experience: wallet-native auction flow with clear privacy states and readable settlement mechanics.

Impact: prevents reactive bidding, bid leakage, and MEV around auctions, treasury sales, NFT drops, RWAs, and OTC allocations.

Clarity: the app explains exactly what Arcium hides, what it reveals, and where the MXE program fits.
