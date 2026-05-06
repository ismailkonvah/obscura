import {
  ARCIUM_AUCTION_INTEGRATION,
  isArciumDevnetConfigured,
  type BlindAuctionFormat,
} from "@/lib/arcium";

export type ArciumEncryptedBidPayload = {
  computationDefinition: string;
  mode: "arcium-devnet" | "demo-local";
  format: BlindAuctionFormat;
  mxeProgramId: string;
  clientPublicKey: number[];
  nonce: number[];
  ciphertext: number[][];
  commitmentHash: string;
  plaintextShape: string[];
  bidderCommitment: string;
};

type EncryptBidInput = {
  auctionId: string;
  bidder: string;
  format: BlindAuctionFormat;
  bidLamports: bigint;
};

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function hashBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  const digest = await crypto.subtle.digest("SHA-256", merged);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

export function bigIntToLeBytes(value: bigint, length = 16) {
  const bytes = new Uint8Array(length);
  let cursor = value;
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Number(cursor & 0xffn);
    cursor >>= 8n;
  }
  return bytes;
}

async function demoMxePublicKey() {
  const { x25519 } = await import("@arcium-hq/client");
  const seed = new Uint8Array(await crypto.subtle.digest("SHA-256", textBytes("obscura-demo-mxe")));
  return x25519.getPublicKey(seed);
}

export function parseMxePublicKey(value: string) {
  if (value === "demo-threshold-key") return null;
  const cleanHex = value.startsWith("0x") ? value.slice(2) : value;
  if (/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
    return new Uint8Array(cleanHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);
  }
  try {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function deriveAuctionCommitment(auctionId: string) {
  return BigInt(`0x${(await hashBytes([textBytes(auctionId)])).slice(0, 16)}`);
}

export async function deriveBidderCommitment(bidder: string) {
  return BigInt(`0x${(await hashBytes([textBytes(bidder)])).slice(0, 16)}`);
}

type SettlementBatchBid = {
  auctionId: string;
  bidder: string;
  bidLamports: bigint;
};

export type ArciumSettlementBatchPayload = {
  clientPublicKey: number[];
  nonce: number[];
  ciphertextAmounts: number[][];
  ciphertextBidders: number[][];
  bidderCommitments: string[];
  bidLamports: string[];
};

export async function encryptSettlementBatchForArcium(
  format: BlindAuctionFormat,
  bids: SettlementBatchBid[],
): Promise<ArciumSettlementBatchPayload> {
  const { RescueCipher, x25519 } = await import("@arcium-hq/client");
  const clientPrivateKey = randomBytes(32);
  const clientPublicKey = x25519.getPublicKey(clientPrivateKey);
  const configuredMxePublicKey = parseMxePublicKey(ARCIUM_AUCTION_INTEGRATION.mxePublicKey);
  const mxePublicKey = configuredMxePublicKey ?? (await demoMxePublicKey());
  const sharedSecret = x25519.getSharedSecret(clientPrivateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);
  const nonce = randomBytes(16);

  const padded = Array.from({ length: 3 }, (_, index) => bids[index] ?? null);
  const amounts = padded.map((bid) => bid?.bidLamports ?? 0n);
  const bidderCommitments = await Promise.all(
    padded.map(async (bid) => (bid ? deriveBidderCommitment(bid.bidder) : 0n)),
  );

  const ciphertext = cipher.encrypt([...amounts, ...bidderCommitments], nonce);

  return {
    clientPublicKey: Array.from(clientPublicKey),
    nonce: Array.from(nonce),
    ciphertextAmounts: ciphertext.slice(0, 3),
    ciphertextBidders: ciphertext.slice(3, 6),
    bidderCommitments: bidderCommitments.map((value) => value.toString()),
    bidLamports: amounts.map((value) => value.toString()),
  };
}

export async function encryptBidForArcium(
  input: EncryptBidInput,
): Promise<ArciumEncryptedBidPayload> {
  const { RescueCipher, x25519 } = await import("@arcium-hq/client");
  const clientPrivateKey = randomBytes(32);
  const clientPublicKey = x25519.getPublicKey(clientPrivateKey);
  const configuredMxePublicKey = parseMxePublicKey(ARCIUM_AUCTION_INTEGRATION.mxePublicKey);
  const mxePublicKey = configuredMxePublicKey ?? (await demoMxePublicKey());
  const sharedSecret = x25519.getSharedSecret(clientPrivateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);
  const nonce = randomBytes(16);
  const auctionCommitment = await deriveAuctionCommitment(input.auctionId);
  const bidderCommitment = await deriveBidderCommitment(input.bidder);
  const ciphertext = cipher.encrypt(
    [auctionCommitment, input.bidLamports, bidderCommitment],
    nonce,
  );
  const commitmentHash = await hashBytes([
    textBytes(input.auctionId),
    textBytes(input.bidder),
    bigIntToLeBytes(input.bidLamports),
    new Uint8Array(ciphertext.flat()),
    nonce,
    clientPublicKey,
  ]);

  return {
    computationDefinition: ARCIUM_AUCTION_INTEGRATION.computationDefinition,
    mode: isArciumDevnetConfigured() ? "arcium-devnet" : "demo-local",
    format: input.format,
    mxeProgramId: ARCIUM_AUCTION_INTEGRATION.mxeProgramId,
    clientPublicKey: Array.from(clientPublicKey),
    nonce: Array.from(nonce),
    ciphertext,
    commitmentHash,
    plaintextShape: ["auction_commitment", "bid_lamports", "bidder_commitment"],
    bidderCommitment: bidderCommitment.toString(),
  };
}
