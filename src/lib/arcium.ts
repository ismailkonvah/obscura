export type BlindAuctionFormat = "sealed-bid" | "vickrey" | "uniform-price";

export const ARCIUM_AUCTION_INTEGRATION = {
  sdk: "@arcium-hq/client",
  network: "Solana devnet",
  arciumProgramId: "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ",
  mxeProgramId: import.meta.env.VITE_ARCIUM_MXE_PROGRAM_ID ?? "not-deployed-yet",
  mxePublicKey: import.meta.env.VITE_ARCIUM_MXE_PUBLIC_KEY ?? "demo-threshold-key",
  clusterOffset: Number(import.meta.env.VITE_ARCIUM_CLUSTER_OFFSET ?? "456"),
  computationDefinition: "resolve_blind_auction",
  bidInputType: "BlindAuctionBid(lot_id: u64, bid_lamports: u64, bidder_commitment: u256)",
  privacyModel: [
    "Bid amount is encrypted in the browser before submission.",
    "Arcium MPC nodes compare encrypted bids without seeing plaintext.",
    "Only the settlement result is revealed at close: winner, clearing price, and allocations.",
  ],
} as const;

export function isArciumDevnetConfigured() {
  return (
    ARCIUM_AUCTION_INTEGRATION.mxeProgramId !== "not-deployed-yet" &&
    ARCIUM_AUCTION_INTEGRATION.mxePublicKey !== "demo-threshold-key" &&
    Number.isFinite(ARCIUM_AUCTION_INTEGRATION.clusterOffset)
  );
}

export const bidInputFields = [
  { name: "lot_id", type: "u64" },
  { name: "bid_lamports", type: "u64" },
  { name: "bidder_commitment", type: "u256" },
] as const;

export function getFormatPrivacy(format: BlindAuctionFormat) {
  switch (format) {
    case "sealed-bid":
      return "First-price settlement: highest encrypted bid wins and pays its own bid.";
    case "vickrey":
      return "Second-price settlement: highest encrypted bid wins, but Arcium reveals only the second-price clearing value.";
    case "uniform-price":
      return "Multi-unit settlement: Arcium computes the clearing price over encrypted demand and reveals only allocations.";
  }
}
