import type { ArciumEncryptedBidPayload } from "@/lib/arciumBidEncryption";
import type { BlindAuctionFormat } from "@/lib/arcium";

export type AuctionProgramMode = "demo-local" | "arcium-devnet";

export type CreateAuctionRequest = {
  lotId: string;
  format: BlindAuctionFormat;
  reserveLamports: bigint;
  closeSlot: bigint;
};

export type SubmitBidRequest = {
  auctionId: string;
  bidder: string;
  bidLamports: bigint;
  encryptedPayload?: ArciumEncryptedBidPayload;
};

export type ResolveAuctionRequest = {
  auctionId: string;
};

export type ProgramReceipt = {
  mode: AuctionProgramMode;
  signature: string;
  note: string;
  arcium?: ArciumEncryptedBidPayload;
  result?: {
    queueSignature?: string;
    finalizationSignature?: string;
    computationOffset?: string;
    winnerCommitment?: string;
    clearingLamports?: string;
    secondPriceLamports?: string;
    bidCount?: number;
  };
};

export interface AuctionProgramClient {
  createAuction(input: CreateAuctionRequest): Promise<ProgramReceipt>;
  submitEncryptedBid(input: SubmitBidRequest): Promise<ProgramReceipt>;
  resolveAuction(input: ResolveAuctionRequest): Promise<ProgramReceipt>;
}

function demoSignature(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export const demoAuctionProgramClient: AuctionProgramClient = {
  async createAuction() {
    return {
      mode: "demo-local",
      signature: demoSignature("create"),
      note: "Local demo receipt. Replace with Arcium/Anchor create instruction after MXE deployment.",
    };
  },
  async submitEncryptedBid(input) {
    return {
      mode: input.encryptedPayload?.mode ?? "demo-local",
      signature: demoSignature(
        input.encryptedPayload?.mode === "arcium-devnet" ? "arcium-bid" : "sealed-bid",
      ),
      note:
        input.encryptedPayload?.mode === "arcium-devnet"
          ? "Arcium encrypted bid payload prepared for devnet submission."
          : "Bid encrypted with the Arcium client SDK, then stored locally until the Obscura MXE program is deployed.",
      arcium: input.encryptedPayload,
    };
  },
  async resolveAuction() {
    return {
      mode: "demo-local",
      signature: demoSignature("resolve"),
      note: "Local settlement receipt. Replace with Arcium computation finalization.",
    };
  },
};
