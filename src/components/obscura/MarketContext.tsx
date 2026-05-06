import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import art from "@/assets/lot-art.jpg";
import tokens from "@/assets/lot-tokens.jpg";
import watch from "@/assets/lot-watch.jpg";
import wine from "@/assets/lot-wine.jpg";
import { demoAuctionProgramClient, type ProgramReceipt } from "@/lib/auctionProgramClient";
import { encryptBidForArcium } from "@/lib/arciumBidEncryption";
import type { SettlementTransferReceipt, TokenMintReceipt } from "@/lib/devnetTokens";

export type OwnedLot = {
  id: string;
  title: string;
  image: string;
  collection: string;
  mintedAt: string;
  description?: string;
  mint?: string;
  tokenAccount?: string;
  mintSignature?: string;
};

export type MarketAuction = {
  id: string;
  lot: string;
  title: string;
  image: string;
  type: "Sealed-Bid" | "Uniform Price" | "Vickrey" | "Dutch";
  reserve: string;
  ends: string;
  status: "live" | "settling" | "soon";
  bidders: number;
  encryptedBids: number;
  owner: string;
  sourceLotId?: string;
  createdAt?: string;
  closesAt?: string;
  resolved?: boolean;
  winner?: string;
  clearingPrice?: string;
  description?: string;
  mint?: string;
  tokenAccount?: string;
  mintSignature?: string;
  receipt?: ProgramReceipt;
  createReceipt?: ProgramReceipt;
  resolutionReceipt?: ProgramReceipt;
  settlement?: SettlementTransferReceipt[];
};

export type BidCommitment = {
  id: string;
  auctionId: string;
  bidder: string;
  amount: number;
  createdAt: string;
  receipt?: ProgramReceipt;
  escrow?: TokenMintReceipt;
};

type MarketState = {
  ownedLots: OwnedLot[];
  auctions: MarketAuction[];
  commitments: BidCommitment[];
  confidentialBalance: number;
};

type ResolveAuctionComputation = {
  winnerBidder?: string;
  clearingAmount: number;
  receipt?: ProgramReceipt;
};

type ResolveAuctionOptions = {
  determine?: (input: {
    auction: MarketAuction;
    bids: BidCommitment[];
  }) => Promise<ResolveAuctionComputation | undefined>;
  settle?: (input: {
    auction: MarketAuction;
    winner?: BidCommitment;
    clearingAmount: number;
    sellerProceeds?: { amount: number; escrow: TokenMintReceipt };
    refunds: { bidder: string; amount: number; escrow: TokenMintReceipt }[];
  }) => Promise<SettlementTransferReceipt[]>;
};

type MarketContextValue = MarketState & {
  loaded: boolean;
  mintDemoLot: (receipt?: { mint: string; tokenAccount: string; signature: string }) => OwnedLot;
  wrapDevnetSol: (amount: number) => void;
  unwrapDevnetSol: (amount: number) => void;
  setConfidentialBalance: (amount: number) => void;
  createAuction: (input: {
    lotId?: string;
    lot?: {
      title: string;
      image: string;
      collection: string;
      description?: string;
      mint?: string;
      tokenAccount?: string;
      mintSignature?: string;
    };
    reserve: number;
    type: MarketAuction["type"];
    closesAt: string;
    owner: string;
  }) => Promise<MarketAuction>;
  placeBid: (
    auctionId: string,
    bidder: string,
    amount: number,
    escrowBid?: () => Promise<TokenMintReceipt>,
  ) => Promise<void>;
  resolveAuction: (auctionId: string, options?: ResolveAuctionOptions) => Promise<void>;
  cancelAuction: (auctionId: string, owner: string) => void;
  resetDemoMarket: () => void;
};

const STORAGE_KEY = "obscura.market";

const seededLots: OwnedLot[] = [
  {
    id: "lot-local-1",
    title: "Encrypted Fragment I",
    image: art,
    collection: "Obscura Genesis",
    mintedAt: "devnet",
  },
  {
    id: "lot-local-2",
    title: "Tokenized Treasury Sleeve",
    image: tokens,
    collection: "Private Markets",
    mintedAt: "devnet",
  },
];

const seededAuctions: MarketAuction[] = [
  {
    id: "ob-0148",
    lot: "OB-0148",
    title: "Patek 5711 · Nautilus Ref.",
    image: watch,
    type: "Sealed-Bid",
    reserve: "cSOL 412.00",
    bidders: 38,
    ends: "02:14:38",
    status: "live",
    encryptedBids: 47,
    owner: "protocol",
  },
  {
    id: "ob-0149",
    lot: "OB-0149",
    title: "Fragments — Edition I/IV",
    image: art,
    type: "Vickrey",
    reserve: "cSOL 84.00",
    bidders: 22,
    ends: "06:48:02",
    status: "live",
    encryptedBids: 31,
    owner: "protocol",
  },
  {
    id: "ob-0150",
    lot: "OB-0150",
    title: "DCA Treasury · 250k USDC",
    image: tokens,
    type: "Uniform Price",
    reserve: "$0.9842",
    bidders: 104,
    ends: "00:42:11",
    status: "live",
    encryptedBids: 162,
    owner: "protocol",
  },
  {
    id: "ob-0151",
    lot: "OB-0151",
    title: "Domaine Leroy 1992 · 6-pack",
    image: wine,
    type: "Sealed-Bid",
    reserve: "cSOL 28.50",
    bidders: 14,
    ends: "11:03:55",
    status: "soon",
    encryptedBids: 9,
    owner: "protocol",
  },
];

const MarketContext = createContext<MarketContextValue | null>(null);

function initialState(): MarketState {
  return {
    ownedLots: seededLots.filter((lot) => Boolean(lot.mint && lot.mintSignature)),
    auctions: seededAuctions.filter(
      (auction) => auction.owner !== "protocol" && Boolean(auction.mint),
    ),
    commitments: [],
    confidentialBalance: 0,
  };
}

function normalizeState(state: MarketState): MarketState {
  const ownedLots = state.ownedLots.filter((lot) => Boolean(lot.mint && lot.mintSignature));
  const auctions = state.auctions.filter(
    (auction) => auction.owner !== "protocol" && Boolean(auction.mint),
  );
  const auctionIds = new Set(auctions.map((auction) => auction.id));
  return {
    ...state,
    ownedLots,
    auctions,
    commitments: state.commitments.filter((commitment) => auctionIds.has(commitment.auctionId)),
    confidentialBalance: 0,
  };
}

function persistState(state: MarketState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Local demo state is best-effort.
  }
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<MarketState>(() => initialState());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setState(raw ? normalizeState(JSON.parse(raw)) : initialState());
    } catch {
      setState(initialState());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Local demo state is best-effort.
    }
  }, [loaded, state]);

  const value = useMemo<MarketContextValue>(
    () => ({
      ...state,
      loaded,
      mintDemoLot(receipt) {
        const images = [art, tokens, wine, watch];
        const next: OwnedLot = {
          id: `lot-local-${Date.now()}`,
          title: `Devnet Artifact #${state.ownedLots.length + 1}`,
          image: images[state.ownedLots.length % images.length],
          collection: "Obscura Devnet Mint",
          mintedAt: new Date().toISOString(),
          mint: receipt?.mint,
          tokenAccount: receipt?.tokenAccount,
          mintSignature: receipt?.signature,
        };
        setState((s) => ({ ...s, ownedLots: [next, ...s.ownedLots] }));
        return next;
      },
      wrapDevnetSol(amount) {
        if (!Number.isFinite(amount) || amount <= 0) return;
        setState((s) => ({ ...s, confidentialBalance: s.confidentialBalance + amount }));
      },
      unwrapDevnetSol(amount) {
        if (!Number.isFinite(amount) || amount <= 0) return;
        setState((s) => ({
          ...s,
          confidentialBalance: Math.max(0, s.confidentialBalance - amount),
        }));
      },
      setConfidentialBalance(amount) {
        if (!Number.isFinite(amount) || amount < 0) return;
        setState((s) => ({ ...s, confidentialBalance: amount }));
      },
      async createAuction(input) {
        const lot =
          input.lot ??
          (input.lotId ? state.ownedLots.find((x) => x.id === input.lotId) : undefined);
        if (!lot) throw new Error("Add lot details or select an owned lot.");
        const receipt = await demoAuctionProgramClient.createAuction({
          lotId: input.lotId ?? `lot-inline-${Date.now()}`,
          format:
            input.type === "Vickrey"
              ? "vickrey"
              : input.type === "Uniform Price"
                ? "uniform-price"
                : "sealed-bid",
          reserveLamports: BigInt(Math.round(input.reserve * 1_000_000_000)),
          closeSlot: BigInt(Math.max(0, Math.floor(new Date(input.closesAt).getTime() / 1000))),
        });
        const secondsRemaining = Math.max(
          60,
          Math.ceil((new Date(input.closesAt).getTime() - Date.now()) / 1000),
        );
        const next: MarketAuction = {
          id: `ob-${Date.now().toString().slice(-6)}`,
          lot: `OB-${Date.now().toString().slice(-4)}`,
          title: lot.title,
          image: lot.image,
          type: input.type,
          reserve: `cSOL ${input.reserve.toFixed(2)}`,
          ends: formatDuration(secondsRemaining),
          status: "live",
          bidders: 0,
          encryptedBids: 0,
          owner: input.owner,
          sourceLotId: input.lotId,
          createdAt: new Date().toISOString(),
          closesAt: input.closesAt,
          description: lot.description,
          mint: lot.mint,
          tokenAccount: lot.tokenAccount,
          mintSignature: lot.mintSignature,
          receipt,
          createReceipt: receipt,
        };
        setState((s) => {
          const updated = {
            ...s,
            ownedLots: input.lotId ? s.ownedLots.filter((x) => x.id !== input.lotId) : s.ownedLots,
            auctions: [next, ...s.auctions],
          };
          persistState(updated);
          return updated;
        });
        return next;
      },
      async placeBid(auctionId, bidder, amount, escrowBid) {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const auction = state.auctions.find((item) => item.id === auctionId);
        const format =
          auction?.type === "Vickrey"
            ? "vickrey"
            : auction?.type === "Uniform Price"
              ? "uniform-price"
              : "sealed-bid";
        const bidLamports = BigInt(Math.round(amount * 1_000_000_000));
        const encryptedPayload = await encryptBidForArcium({
          auctionId,
          bidder,
          format,
          bidLamports,
        });
        if (encryptedPayload.mode === "arcium-devnet") {
          const activeBids = state.commitments.filter(
            (commitment) => commitment.auctionId === auctionId,
          );
          if (activeBids.length >= 3) {
            throw new Error(
              "The current live Arcium circuit supports up to 3 sealed bids per auction.",
            );
          }
        }
        const receipt = await demoAuctionProgramClient.submitEncryptedBid({
          auctionId,
          bidder,
          bidLamports,
          encryptedPayload,
        });
        const escrow = escrowBid ? await escrowBid() : undefined;
        setState((s) => ({
          ...s,
          confidentialBalance: Math.max(0, s.confidentialBalance - amount),
          commitments: [
            {
              id: crypto.randomUUID(),
              auctionId,
              bidder,
              amount,
              createdAt: new Date().toISOString(),
              receipt,
              escrow,
            },
            ...s.commitments,
          ],
          auctions: s.auctions.map((a) =>
            a.id === auctionId
              ? { ...a, bidders: a.bidders + 1, encryptedBids: a.encryptedBids + 1 }
              : a,
          ),
        }));
      },
      async resolveAuction(auctionId, settleOrOptions) {
        const auction = state.auctions.find((item) => item.id === auctionId);
        const bids = state.commitments.filter((b) => b.auctionId === auctionId);
        const options =
          typeof settleOrOptions === "function"
            ? { settle: settleOrOptions }
            : (settleOrOptions ?? {});
        const sortedBids = [...bids].sort((a, b) => b.amount - a.amount);
        const resolvedViaClient =
          auction && options.determine
            ? await options.determine({ auction, bids: sortedBids })
            : undefined;
        const winner = resolvedViaClient?.winnerBidder
          ? sortedBids.find((bid) => bid.bidder === resolvedViaClient.winnerBidder)
          : sortedBids[0];
        const secondBid = sortedBids[1];
        const clearingAmount =
          resolvedViaClient?.clearingAmount ??
          (winner && auction?.type === "Vickrey" && secondBid
            ? secondBid.amount
            : (winner?.amount ?? 0));
        const sellerProceeds =
          winner?.escrow && clearingAmount > 0
            ? { amount: clearingAmount, escrow: winner.escrow }
            : undefined;
        const refunds = bids.flatMap((bid) => {
          if (!bid.escrow) return [];
          if (bid.id !== winner?.id) {
            return [{ bidder: bid.bidder, amount: bid.amount, escrow: bid.escrow }];
          }
          const refundAmount = bid.amount - clearingAmount;
          return refundAmount > 0
            ? [{ bidder: bid.bidder, amount: refundAmount, escrow: bid.escrow }]
            : [];
        });
        const settlement =
          auction && options.settle
            ? await options.settle({ auction, winner, clearingAmount, sellerProceeds, refunds })
            : undefined;
        const receipt =
          resolvedViaClient?.receipt ??
          (await demoAuctionProgramClient.resolveAuction({ auctionId }));
        setState((s) => {
          return {
            ...s,
            auctions: s.auctions.map((a) =>
              a.id === auctionId
                ? {
                    ...a,
                    status: "settling",
                    resolved: true,
                    winner: winner?.bidder,
                    clearingPrice: winner ? `cSOL ${clearingAmount.toFixed(2)}` : "No bids",
                    receipt,
                    resolutionReceipt: receipt,
                    settlement,
                  }
                : a,
            ),
          };
        });
      },
      cancelAuction(auctionId, owner) {
        setState((s) => ({
          ...s,
          auctions: s.auctions.filter(
            (a) => !(a.id === auctionId && a.owner === owner && a.encryptedBids === 0),
          ),
        }));
      },
      resetDemoMarket() {
        setState((s) => {
          const updated = {
            ...s,
            ownedLots: [],
            auctions: [],
            commitments: [],
          };
          persistState(updated);
          return updated;
        });
      },
    }),
    [loaded, state],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const value = useContext(MarketContext);
  if (!value) throw new Error("useMarket outside MarketProvider");
  return value;
}
