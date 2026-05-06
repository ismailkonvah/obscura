import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  awaitComputationFinalization,
  deserializeLE,
  getClusterAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getComputationAccAddress,
  getExecutingPoolAccAddress,
  getMempoolAccAddress,
  getMXEAccAddress,
} from "@arcium-hq/client";

import type { BidCommitment, MarketAuction } from "@/components/obscura/MarketContext";
import type { ProgramReceipt } from "@/lib/auctionProgramClient";
import {
  ARCIUM_AUCTION_INTEGRATION,
  type BlindAuctionFormat,
  isArciumDevnetConfigured,
} from "@/lib/arcium";
import { deriveBidderCommitment, encryptSettlementBatchForArcium } from "@/lib/arciumBidEncryption";
import { obscuraMxeIdl } from "@/lib/obscuraMxeIdl";
import { DEVNET_RPC } from "@/lib/solanaRpc";

export type ArciumResolveResult = {
  winnerBidder?: string;
  winnerCommitment?: string;
  clearingAmount: number;
  secondPriceAmount: number;
  bidCount: number;
  receipt: ProgramReceipt;
};

type ResolveViaArciumInput = {
  auction: MarketAuction;
  bids: BidCommitment[];
  walletAddress: string;
  signAndSendTransaction: (transaction: Transaction) => Promise<string>;
};

function compDefOffsetToNumber(offset: Uint8Array) {
  return new DataView(offset.buffer, offset.byteOffset, 4).getUint32(0, true);
}

function createReadOnlyProvider() {
  const wallet = {
    publicKey: Keypair.generate().publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T) {
      return tx;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]) {
      return txs;
    },
  };
  const connection = new Connection(DEVNET_RPC, "confirmed");
  return new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

function randomComputationOffset() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return new anchor.BN(hex, "hex");
}

function formatToU8(format: BlindAuctionFormat) {
  if (format === "vickrey") return 1;
  if (format === "sealed-bid") return 0;
  throw new Error("The current live Arcium circuit supports sealed-bid and Vickrey settlement.");
}

function deriveFormat(auction: MarketAuction): BlindAuctionFormat {
  if (auction.type === "Vickrey") return "vickrey";
  if (auction.type === "Uniform Price") return "uniform-price";
  return "sealed-bid";
}

async function findResolvedEvent(
  connection: Connection,
  program: anchor.Program,
  finalizationSignature: string,
) {
  const tx = await connection.getTransaction(finalizationSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const logs = tx?.meta?.logMessages ?? [];
  const parser = new anchor.EventParser(program.programId, program.coder);
  for (const event of parser.parseLogs(logs)) {
    if (event.name === "BlindAuctionResolvedEvent") {
      return event.data as {
        winnerCommitment: anchor.BN;
        clearingPriceLamports: anchor.BN;
        secondPriceLamports: anchor.BN;
        bidCount: number;
      };
    }
  }
  return null;
}

export async function resolveAuctionViaArciumDevnet({
  auction,
  bids,
  walletAddress,
  signAndSendTransaction,
}: ResolveViaArciumInput): Promise<ArciumResolveResult> {
  if (!isArciumDevnetConfigured()) {
    throw new Error("Arcium devnet metadata is not configured.");
  }

  const format = deriveFormat(auction);
  const supportedBids = bids.filter((bid) => bid.amount > 0);
  if (format === "uniform-price") {
    throw new Error(
      "Uniform-price still settles through the local fallback until the MXE circuit supports allocations.",
    );
  }
  if (supportedBids.length === 0) {
    return {
      clearingAmount: 0,
      secondPriceAmount: 0,
      bidCount: 0,
      receipt: {
        mode: "arcium-devnet",
        signature: `arcium-empty-${auction.id}`,
        note: "No bids were queued for Arcium settlement.",
      },
    };
  }
  if (supportedBids.length > 3) {
    throw new Error("The current live Arcium circuit supports up to 3 sealed bids per auction.");
  }

  const provider = createReadOnlyProvider();
  const program = new anchor.Program(obscuraMxeIdl, provider);
  const batch = await encryptSettlementBatchForArcium(
    format,
    supportedBids.map((bid) => ({
      auctionId: auction.id,
      bidder: bid.bidder,
      bidLamports: BigInt(Math.round(bid.amount * 1_000_000_000)),
    })),
  );

  const computationOffset = randomComputationOffset();
  const queueTx = await program.methods
    .resolveBlindAuction(
      computationOffset,
      batch.ciphertextAmounts[0] ?? Array(32).fill(0),
      batch.ciphertextAmounts[1] ?? Array(32).fill(0),
      batch.ciphertextAmounts[2] ?? Array(32).fill(0),
      batch.ciphertextBidders[0] ?? Array(32).fill(0),
      batch.ciphertextBidders[1] ?? Array(32).fill(0),
      batch.ciphertextBidders[2] ?? Array(32).fill(0),
      batch.clientPublicKey,
      new anchor.BN(deserializeLE(Uint8Array.from(batch.nonce)).toString()),
      formatToU8(format),
    )
    .accountsPartial({
      payer: new PublicKey(walletAddress),
      mxeAccount: getMXEAccAddress(program.programId),
      mempoolAccount: getMempoolAccAddress(ARCIUM_AUCTION_INTEGRATION.clusterOffset),
      executingPool: getExecutingPoolAccAddress(ARCIUM_AUCTION_INTEGRATION.clusterOffset),
      computationAccount: getComputationAccAddress(
        ARCIUM_AUCTION_INTEGRATION.clusterOffset,
        computationOffset,
      ),
      compDefAccount: getCompDefAccAddress(
        program.programId,
        compDefOffsetToNumber(
          getCompDefAccOffset(ARCIUM_AUCTION_INTEGRATION.computationDefinition),
        ),
      ),
      clusterAccount: getClusterAccAddress(ARCIUM_AUCTION_INTEGRATION.clusterOffset),
    })
    .transaction();

  const latest = await provider.connection.getLatestBlockhash("confirmed");
  queueTx.feePayer = new PublicKey(walletAddress);
  queueTx.recentBlockhash = latest.blockhash;
  queueTx.lastValidBlockHeight = latest.lastValidBlockHeight;

  const queueSignature = await signAndSendTransaction(queueTx);
  await provider.connection.confirmTransaction(
    {
      signature: queueSignature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed",
  );

  const finalizationSignature = await awaitComputationFinalization(
    provider,
    computationOffset,
    program.programId,
    "confirmed",
    240_000,
  );
  const resolvedEvent = await findResolvedEvent(
    provider.connection,
    program,
    finalizationSignature,
  );
  if (!resolvedEvent) {
    throw new Error("Arcium computation finalized, but no BlindAuctionResolvedEvent was found.");
  }

  const winnerCommitment = resolvedEvent.winnerCommitment.toString();
  const bidderCommitments = await Promise.all(
    supportedBids.map(async (bid) => ({
      bidder: bid.bidder,
      commitment: (await deriveBidderCommitment(bid.bidder)).toString(),
    })),
  );
  const winnerBidder = bidderCommitments.find(
    (entry) => entry.commitment === winnerCommitment,
  )?.bidder;
  const clearingLamports = Number(resolvedEvent.clearingPriceLamports.toString());
  const secondPriceLamports = Number(resolvedEvent.secondPriceLamports.toString());

  return {
    winnerBidder,
    winnerCommitment,
    clearingAmount: clearingLamports / 1_000_000_000,
    secondPriceAmount: secondPriceLamports / 1_000_000_000,
    bidCount: resolvedEvent.bidCount,
    receipt: {
      mode: "arcium-devnet",
      signature: finalizationSignature,
      note: `Arcium blind auction finalized from queued computation ${computationOffset.toString()}.`,
      result: {
        queueSignature,
        finalizationSignature,
        computationOffset: computationOffset.toString(),
        winnerCommitment,
        clearingLamports: clearingLamports.toString(),
        secondPriceLamports: secondPriceLamports.toString(),
        bidCount: resolvedEvent.bidCount,
      },
    },
  };
}
