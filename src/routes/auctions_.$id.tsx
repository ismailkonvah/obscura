import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/obscura/Nav";
import { Footer } from "@/components/obscura/Footer";
import { useMarket, type MarketAuction } from "@/components/obscura/MarketContext";
import { ARCIUM_AUCTION_INTEGRATION, isArciumDevnetConfigured } from "@/lib/arcium";
import { resolveAuctionViaArciumDevnet } from "@/lib/arciumResolveClient";
import { useWallet, shortAddr } from "@/components/obscura/WalletContext";
import {
  escrowCsolForBid,
  settleDevnetAuctionEscrow,
  type SettlementTransferReceipt,
} from "@/lib/devnetTokens";

export const Route = createFileRoute("/auctions_/$id")({
  head: () => ({
    meta: [
      { title: "Auction - Obscura" },
      { name: "description", content: "Confidential sealed-bid auction." },
    ],
  }),
  component: AuctionDetail,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Lot not found.
    </div>
  ),
  errorComponent: AuctionError,
});

function AuctionError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-3 text-muted-foreground">
      <p>{error.message}</p>
      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="text-emerald"
      >
        Retry
      </button>
    </div>
  );
}

type Phase = "idle" | "encrypting" | "submitting" | "sealed" | "error";

function AuctionDetail() {
  const { id } = Route.useParams();
  const wallet = useWallet();
  const market = useMarket();
  const { auctions, loaded, placeBid, resolveAuction } = market;
  const [storedAuction, setStoredAuction] = useState<MarketAuction | null>(null);
  const [storageChecked, setStorageChecked] = useState(false);
  const a = auctions.find((x) => x.id === id) ?? storedAuction;

  const [bid, setBid] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [mobileSheet, setMobileSheet] = useState(false);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (a) {
      setStorageChecked(true);
      return;
    }
    if (!loaded || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("obscura.market");
      if (!raw) {
        setStoredAuction(null);
        return;
      }
      const parsed = JSON.parse(raw) as { auctions?: MarketAuction[] };
      setStoredAuction(parsed.auctions?.find((auction) => auction.id === id) ?? null);
    } catch {
      setStoredAuction(null);
    } finally {
      setStorageChecked(true);
    }
  }, [a, id, loaded]);

  async function submit() {
    if (!a) return;
    const amount = parseFloat(bid);
    if (!amount || amount <= 0) {
      setPhase("error");
      setErrMsg("Enter a positive bid amount.");
      return;
    }
    if (!wallet.address) {
      setPhase("error");
      setErrMsg("Connect a devnet wallet before bidding.");
      return;
    }
    const bidder = wallet.address;
    if (amount + 0.00012 > market.confidentialBalance) {
      setPhase("error");
      setErrMsg("Wrap devnet SOL into cSOL before bidding, or lower the bid amount.");
      return;
    }
    try {
      setPhase("encrypting");
      setErrMsg(null);
      await new Promise((r) => setTimeout(r, 500));
      setPhase("submitting");
      await placeBid(a.id, bidder, amount, () =>
        escrowCsolForBid({
          owner: bidder,
          auctionId: a.id,
          amount,
          signAndSendTransaction: wallet.signAndSendTransaction,
        }),
      );
      setPhase("sealed");
    } catch (err) {
      setPhase("error");
      setErrMsg(err instanceof Error ? err.message : "Unable to encrypt and submit this bid.");
    }
  }

  function reset() {
    setPhase("idle");
    setErrMsg(null);
  }

  async function settleAuction() {
    if (!a) return;
    if (!wallet.address) {
      setPhase("error");
      setErrMsg("Connect the creator wallet before settlement.");
      return;
    }
    if (wallet.address !== a.owner) {
      setPhase("error");
      setErrMsg("Only the auction creator can settle this auction.");
      return;
    }
    setSettling(true);
    setErrMsg(null);
    try {
      await resolveAuction(a.id, {
        determine: async ({ auction, bids }) => {
          if (!wallet.address || !isArciumDevnetConfigured()) return undefined;
          if (auction.type === "Uniform Price") return undefined;
          try {
            return await resolveAuctionViaArciumDevnet({
              auction,
              bids,
              walletAddress: wallet.address,
              signAndSendTransaction: wallet.signAndSendTransaction,
            });
          } catch (error) {
            console.warn("Arcium settlement fallback", error);
            setErrMsg(
              error instanceof Error
                ? `Arcium settlement fallback: ${error.message}`
                : "Arcium settlement fallback triggered.",
            );
            return undefined;
          }
        },
        settle: ({ winner, sellerProceeds, refunds }) =>
          settleDevnetAuctionEscrow({
            settler: wallet.address!,
            auctionId: a.id,
            seller: a.owner,
            lotMint: a.mint,
            winner: winner?.bidder,
            sellerProceeds,
            refunds,
            signAndSendTransaction: wallet.signAndSendTransaction,
          }),
      });
    } catch (err) {
      setPhase("error");
      setErrMsg(err instanceof Error ? err.message : "Unable to settle auction escrow.");
    } finally {
      setSettling(false);
    }
  }

  if (!a && (!loaded || !storageChecked)) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <main className="mx-auto max-w-[900px] px-6 lg:px-10 pt-20">
          <div className="rounded-lg border border-hairline bg-surface p-8 sm:p-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
              Loading auction
            </div>
            <h1 className="mt-3 font-display text-[42px] leading-tight">Opening sealed desk.</h1>
          </div>
        </main>
      </div>
    );
  }

  if (!a) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <main className="mx-auto max-w-[900px] px-6 lg:px-10 pt-20">
          <div className="rounded-lg border border-hairline bg-surface p-8 sm:p-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
              Auction not found
            </div>
            <h1 className="mt-3 font-display text-[42px] leading-tight">This lot is not live.</h1>
            <p className="mt-4 max-w-lg text-muted-foreground">
              The seeded market auctions have been cleared. Create a new Obscura auction from a
              minted devnet lot to open a real bidding page.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/auctions"
                className="inline-flex h-10 items-center rounded-md border border-hairline px-4 text-[13px] hover:border-emerald/50 transition-colors"
              >
                Back to auctions
              </Link>
              <Link
                to="/create-auction"
                className="inline-flex h-10 items-center rounded-md bg-emerald px-4 text-[13px] font-medium text-background"
              >
                Create auction
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <Nav />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 flex items-center gap-2 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary overflow-x-auto">
        <Link to="/" className="hover:text-foreground">
          Obscura
        </Link>
        <span>/</span>
        <Link to="/auctions" className="hover:text-foreground">
          Auctions
        </Link>
        <span>/</span>
        <span className="text-foreground whitespace-nowrap">{a.lot}</span>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* LEFT */}
        <div className="lg:col-span-7 space-y-6">
          <div
            className="rounded-lg overflow-hidden border border-hairline bg-surface"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            <div className="aspect-[5/4] sm:aspect-[5/4] relative">
              <img
                src={a.image}
                alt={a.title}
                loading="eager"
                className="h-full w-full object-cover"
              />
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-2">
                <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-sm bg-background/80 backdrop-blur border border-hairline text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  {a.type}
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-sm bg-background/80 backdrop-blur border border-hairline">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald pulse-dot" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                    {a.resolved ? "Settled" : "Bidding open"}
                  </span>
                </span>
              </div>
              <CompactCountdown
                ends={a.ends}
                closesAt={a.closesAt}
                className="lg:hidden absolute bottom-3 right-3"
              />
            </div>
            <div className="p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4 sm:gap-6">
                <div className="min-w-0">
                  <div className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
                    Lot / {a.lot} / Consignor verified
                  </div>
                  <h1 className="mt-2 font-display text-[28px] sm:text-[40px] leading-[1.02] tracking-[-0.02em]">
                    {a.title}
                  </h1>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tertiary">
                    Reserve
                  </div>
                  <div className="font-display text-[22px] sm:text-[28px] tabular mt-0.5">
                    {a.reserve}
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-7 grid grid-cols-2 sm:grid-cols-4 gap-px bg-hairline border border-hairline">
                {[
                  ["Bidders", a.bidders.toString()],
                  ["Sealed bids", a.encryptedBids.toString()],
                  ["MPC nodes", "48 / 48"],
                  ["Settles", "Atomic cSOL"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-surface px-4 py-3 sm:py-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
                      {k}
                    </div>
                    <div className="mt-1 font-mono tabular text-[14px] sm:text-[15px]">{v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-7">
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
                  Description
                </div>
                <p className="mt-3 text-[14px] sm:text-[14.5px] text-muted-foreground leading-relaxed max-w-2xl">
                  {a.description ||
                    "Seller-provided lot metadata is public for bidder review. Settlement transfers custody and proceeds atomically on-chain. Losing bids remain cryptographically sealed."}
                </p>
                {a.mint && (
                  <div className="mt-4 rounded-md border border-hairline bg-background p-3 font-mono text-[11px] text-muted-foreground">
                    <div className="text-emerald">devnet SPL lot</div>
                    <div className="mt-1 break-all">mint {a.mint}</div>
                    {a.tokenAccount && <div className="mt-1 break-all">ata {a.tokenAccount}</div>}
                  </div>
                )}
              </div>

              <div className="mt-7 hairline-t pt-5">
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary mb-4">
                  Privacy guarantees
                </div>
                <ul className="grid sm:grid-cols-2 gap-2.5 text-[13.5px]">
                  {[
                    "Bid amount encrypted on device",
                    "MPC settlement without a single decryptor",
                    "Only the winning price is revealed",
                    "Losing identities discarded",
                  ].map((g) => (
                    <li key={g} className="flex items-start gap-2.5 text-muted-foreground">
                      <span className="mt-1.5 h-1 w-3 bg-emerald shrink-0" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <SealedDemandPanel base={a.encryptedBids} />
          <PrivacyBoundaryPanel />
          <ActivityFeed auction={a} />
        </div>

        {/* RIGHT (desktop) */}
        <aside className="hidden lg:block lg:col-span-5">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Countdown ends={a.ends} closesAt={a.closesAt} />
            <BidPanel
              bid={bid}
              setBid={setBid}
              phase={phase}
              submit={submit}
              reset={reset}
              reserve={a.reserve}
              errMsg={errMsg}
              auctionId={a.id}
              owner={a.owner}
              resolved={a.resolved}
              winner={a.winner}
              clearingPrice={a.clearingPrice}
              receiptMode={a.resolutionReceipt?.mode}
              receiptSignature={a.resolutionReceipt?.signature}
              settlement={a.settlement}
              settling={settling}
              onResolve={settleAuction}
            />
          </div>
        </aside>
      </div>

      {/* MOBILE sticky bid */}
      <MobileBidBar
        phase={phase}
        bid={bid}
        reserve={a.reserve}
        onOpen={() => setMobileSheet(true)}
      />

      {mobileSheet && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setMobileSheet(false)}
          />
          <div className="relative w-full max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="mx-auto h-1 w-10 rounded-full bg-hairline" />
            </div>
            <div className="px-4 pb-6 space-y-4">
              <Countdown ends={a.ends} closesAt={a.closesAt} />
              <BidPanel
                bid={bid}
                setBid={setBid}
                phase={phase}
                submit={submit}
                reset={reset}
                reserve={a.reserve}
                errMsg={errMsg}
                auctionId={a.id}
                owner={a.owner}
                resolved={a.resolved}
                winner={a.winner}
                clearingPrice={a.clearingPrice}
                receiptMode={a.resolutionReceipt?.mode}
                receiptSignature={a.resolutionReceipt?.signature}
                settlement={a.settlement}
                settling={settling}
                onResolve={settleAuction}
              />
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:block">
        <Footer />
      </div>
    </div>
  );
}

function PrivacyBoundaryPanel() {
  const columns = [
    {
      title: "Hidden until close",
      items: ["Bid amounts", "Losing bids", "Bidder strategy", "Intermediate ranking"],
    },
    {
      title: "Revealed at settlement",
      items: ["Winner commitment", "Clearing price", "Filled allocation", "Settlement proof"],
    },
  ];

  return (
    <div className="rounded-lg border border-hairline bg-surface overflow-hidden">
      <div className="px-5 py-4 hairline-b">
        <div className="font-display text-[18px]">Privacy boundary</div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Obscura is designed so bidders cannot react to each other before close. Arcium computes
          over encrypted bids and reveals only the final auction result.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-px bg-hairline">
        {columns.map((column) => (
          <div key={column.title} className="bg-surface p-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
              {column.title}
            </div>
            <ul className="mt-4 space-y-2">
              {column.items.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-[13px] text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function SealedDemandPanel({ base }: { base: number }) {
  const [tick, setTick] = useState(0);
  const bars = useMemo(
    () => Array.from({ length: 22 }, (_, i) => 18 + ((base * 7 + tick * 5 + i * 13) % 72)),
    [base, tick],
  );

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="rounded-lg border border-hairline bg-surface overflow-hidden"
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      <div className="px-5 py-4 hairline-b flex items-center justify-between gap-4">
        <div>
          <div className="font-display text-[18px]">Sealed demand</div>
          <div className="mt-0.5 text-[11px] font-mono uppercase tracking-[0.18em] text-tertiary">
            Live encrypted orderflow
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono tabular text-[18px] text-emerald">{base + tick * 2}</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
            packets observed
          </div>
        </div>
      </div>
      <div className="relative p-5">
        <div className="absolute inset-0 cipher-rain opacity-35" />
        <div className="relative h-28 flex items-end gap-1.5">
          {bars.map((h, i) => (
            <span
              key={i}
              className={`flex-1 depth-rise ${i < 12 ? "bg-emerald/80" : "bg-electric/50"}`}
              style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-px bg-hairline border border-hairline">
          {[
            ["Visibility", "Amounts hidden"],
            ["Winning reveal", "Price only"],
            ["Node quorum", "48 / 48"],
          ].map(([k, v]) => (
            <div key={k} className="bg-background/80 px-3 py-2">
              <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-tertiary">
                {k}
              </div>
              <div className="mt-1 text-[12px] font-mono tabular">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function useTicker(initial: string, closesAt?: string) {
  // initial format HH:MM:SS and counts down once per second
  const toSec = (s: string) => {
    const [h, m, sec] = s.split(":").map(Number);
    return h * 3600 + m * 60 + sec;
  };
  const remainingFromClose = () => {
    if (!closesAt) return toSec(initial);
    const closeMs = new Date(closesAt).getTime();
    return Number.isFinite(closeMs) ? Math.max(0, Math.ceil((closeMs - Date.now()) / 1000)) : 0;
  };
  const [s, setS] = useState(remainingFromClose);
  useEffect(() => {
    const remaining = () => {
      if (!closesAt) return toSec(initial);
      const closeMs = new Date(closesAt).getTime();
      return Number.isFinite(closeMs) ? Math.max(0, Math.ceil((closeMs - Date.now()) / 1000)) : 0;
    };
    const t = setInterval(() => {
      if (closesAt) {
        setS(remaining());
      } else {
        setS((v) => Math.max(0, v - 1));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [closesAt, initial]);
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return { h: pad(h), m: pad(m), s: pad(sec), totalSec: s };
}

function Countdown({ ends, closesAt }: { ends: string; closesAt?: string }) {
  const { h, m, s, totalSec } = useTicker(ends, closesAt);
  return (
    <div
      className="rounded-lg border border-hairline bg-surface p-5"
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
          Time to settlement
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald pulse-dot" />
          {totalSec === 0 ? "Closing" : "Live"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          ["HRS", h],
          ["MIN", m],
          ["SEC", s],
        ].map(([l, v]) => (
          <div key={l} className="bg-background border border-hairline rounded-md py-3 text-center">
            <div className="font-display text-[34px] tabular leading-none">{v}</div>
            <div className="mt-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-tertiary">
              {l}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactCountdown({
  ends,
  closesAt,
  className = "",
}: {
  ends: string;
  closesAt?: string;
  className?: string;
}) {
  const { h, m, s } = useTicker(ends, closesAt);
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/85 backdrop-blur border border-hairline font-mono tabular text-[12px] ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald pulse-dot" />
      {h}:{m}:{s}
    </div>
  );
}

function BidPanel({
  bid,
  setBid,
  phase,
  submit,
  reset,
  reserve,
  errMsg,
  auctionId,
  owner,
  resolved,
  winner,
  clearingPrice,
  receiptMode,
  receiptSignature,
  settlement,
  settling,
  onResolve,
}: {
  bid: string;
  setBid: (v: string) => void;
  phase: Phase;
  submit: () => void;
  reset: () => void;
  reserve: string;
  errMsg: string | null;
  auctionId: string;
  owner: string;
  resolved?: boolean;
  winner?: string;
  clearingPrice?: string;
  receiptMode?: string;
  receiptSignature?: string;
  settlement?: SettlementTransferReceipt[];
  settling: boolean;
  onResolve: () => Promise<void>;
}) {
  const wallet = useWallet();
  const market = useMarket();
  const amount = parseFloat(bid) || 0;
  const fee = 0.00012;
  const insufficient = wallet.connected && amount > 0 && amount + fee > market.confidentialBalance;
  const belowReserve = amount > 0 && amount < parseFloat(reserve.replace(/[^\d.]/g, ""));
  const isOwner = wallet.connected && wallet.address === owner;

  const inProgress = phase === "encrypting" || phase === "submitting";
  const disabled = inProgress || phase === "sealed" || Boolean(resolved);
  const escrowed = market.commitments.filter((x) => x.auctionId === auctionId).length;
  const latestCommitment = market.commitments.find((x) => x.auctionId === auctionId);
  const arciumPayload = latestCommitment?.receipt?.arcium;
  const activeMode = arciumPayload?.mode ?? receiptMode ?? "demo-local";

  return (
    <div
      className="rounded-lg border border-hairline bg-surface overflow-hidden"
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      <div className="px-5 py-4 hairline-b flex items-center justify-between">
        <div className="font-display text-[18px]">Submit private bid</div>
        <span
          className={`text-[10px] font-mono uppercase tracking-[0.2em] flex items-center gap-1.5 ${phase === "error" ? "text-destructive" : "text-emerald"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${phase === "error" ? "bg-destructive" : "bg-emerald"} ${inProgress ? "pulse-dot" : ""}`}
          />
          {phase === "encrypting"
            ? "Encrypting"
            : phase === "submitting"
              ? "Broadcasting"
              : phase === "sealed"
                ? "Sealed"
                : phase === "error"
                  ? "Failed"
                  : "Encrypted channel"}
        </span>
      </div>

      {/* Wallet strip */}
      <div className="px-5 py-3 hairline-b flex items-center justify-between text-[12px]">
        {wallet.connected ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-6 w-6 rounded-sm bg-gradient-to-br from-emerald to-electric/70" />
              <div className="min-w-0">
                <div className="font-mono text-[12px] truncate">{shortAddr(wallet.address)}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
                  Solana / Devnet
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono tabular text-[14px]">
                cSOL {market.confidentialBalance.toFixed(4)}
              </div>
              <div className="text-[10px] font-mono text-tertiary">Private balance</div>
            </div>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Connect a devnet wallet to bid</span>
            <button
              onClick={wallet.connect}
              disabled={wallet.connecting}
              className="h-7 px-3 rounded-md border border-hairline bg-surface-elevated text-[11px] font-medium hover:border-emerald/50 transition-colors disabled:opacity-60"
            >
              {wallet.connecting ? "Connecting..." : "Connect"}
            </button>
          </>
        )}
      </div>

      <div className="p-5 space-y-5">
        <ProgressTrack phase={phase} />

        <div>
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
            <span>Bid amount</span>
            <span>Reserve / {reserve}</span>
          </div>
          <div className="mt-2 relative">
            <input
              value={bid}
              onChange={(e) => {
                setBid(e.target.value.replace(/[^\d.]/g, ""));
                if (phase === "error") reset();
              }}
              disabled={disabled}
              placeholder="0.00"
              inputMode="decimal"
              className={`w-full h-14 bg-background border rounded-md px-4 pr-20 font-mono tabular text-[24px] focus:outline-none transition-colors disabled:opacity-60
                ${insufficient || phase === "error" ? "border-destructive/50 focus:border-destructive/70" : "border-hairline focus:border-emerald/60"}`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[12px] uppercase tracking-[0.2em] text-tertiary">
              cSOL
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
            <span className={belowReserve ? "text-amber-400/80" : "text-muted-foreground"}>
              {belowReserve
                ? "Below reserve / may not clear"
                : wallet.connected
                  ? `cSOL / ${market.confidentialBalance.toFixed(4)}`
                  : "--"}
            </span>
            <div className="flex gap-1">
              {[0.25, 0.5, 1].map((p, i) => (
                <button
                  key={i}
                  disabled={disabled || !wallet.connected}
                  onClick={() => setBid((market.confidentialBalance * p * 0.99).toFixed(2))}
                  className="px-2 py-0.5 border border-hairline rounded-sm hover:border-foreground/30 disabled:opacity-50"
                >
                  {p === 1 ? "MAX" : `${p * 100}%`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {wallet.connected && market.confidentialBalance <= fee && (
          <div className="rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-[12px] text-muted-foreground">
            <div className="font-medium text-foreground">No spendable cSOL found</div>
            <div className="mt-1">
              Wrap devnet SOL into cSOL before submitting a private bid. This balance is read from
              your actual devnet cSOL token account.
            </div>
          </div>
        )}

        {isOwner && (
          <div className="rounded-md border border-hairline bg-background/60 p-3 text-[12px] text-muted-foreground">
            You created this auction. For the clean demo path, open this link with another devnet
            wallet, wrap cSOL there, then submit the sealed bid.
          </div>
        )}

        <div className="hairline-t pt-4 space-y-2 text-[12px] font-mono">
          <Row k="Mechanism" v="Sealed-bid / 1st price" />
          <Row k="Encryption" v="Arcium MPC / client sealed" />
          <Row k="Arcium program" v={ARCIUM_AUCTION_INTEGRATION.arciumProgramId.slice(0, 10)} />
          <Row k="Client mode" v={activeMode} />
          <Row k="Encrypted bids" v={escrowed.toString()} />
          <Row
            k="MXE key"
            v={
              ARCIUM_AUCTION_INTEGRATION.mxePublicKey === "demo-threshold-key"
                ? "demo-threshold"
                : "configured"
            }
          />
          <Row k="Network fee" v={`~ SOL ${fee.toFixed(5)}`} />
          <Row k="Reveal" v="Only if you win" accent />
        </div>

        {arciumPayload && (
          <div className="rounded-md border border-emerald/25 bg-emerald/5 p-3 text-[11px] font-mono">
            <div className="flex items-center justify-between gap-3">
              <span className="uppercase tracking-[0.18em] text-emerald">
                Arcium sealed payload
              </span>
              <span className="text-tertiary">{arciumPayload.computationDefinition}</span>
            </div>
            <div className="mt-2 break-all text-muted-foreground">
              commitment {arciumPayload.commitmentHash.slice(0, 18)}...
              {arciumPayload.commitmentHash.slice(-10)}
            </div>
            <div className="mt-1 break-all text-tertiary">
              ciphertext blocks {arciumPayload.ciphertext.length} / client key{" "}
              {arciumPayload.clientPublicKey.slice(0, 4).join(".")}...
            </div>
            {latestCommitment?.escrow && (
              <div className="mt-1 break-all text-tertiary">
                escrow ata {latestCommitment.escrow.tokenAccount} / tx{" "}
                {latestCommitment.escrow.signature}
              </div>
            )}
          </div>
        )}

        {resolved && (
          <div className="rounded-md border border-electric/30 bg-electric/5 p-4 text-[12px]">
            <div className="font-medium text-foreground">Auction resolved</div>
            <div className="mt-1 font-mono text-muted-foreground">
              Winner {winner ? shortAddr(winner) : "none"} / {clearingPrice}
            </div>
            {settlement && settlement.length > 0 && (
              <div className="mt-3 space-y-1 font-mono text-[11px] text-tertiary">
                {settlement.map((transfer) => (
                  <div key={`${transfer.kind}-${transfer.recipient}-${transfer.mint}`}>
                    {transfer.kind} / {shortAddr(transfer.recipient)} / tx {transfer.signature}
                  </div>
                ))}
              </div>
            )}
            {receiptSignature && (
              <div className="mt-1 font-mono text-[11px] text-tertiary">
                receipt {receiptSignature}
              </div>
            )}
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-[12px] flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
            <span className="mt-0.5 h-4 w-4 rounded-full border border-destructive/60 text-destructive flex items-center justify-center text-[10px]">
              !
            </span>
            <div className="flex-1">
              <div className="text-foreground font-medium">Bid not sealed</div>
              <div className="text-muted-foreground mt-0.5">{errMsg}</div>
            </div>
            <button
              onClick={() => {
                reset();
                submit();
              }}
              className="text-emerald text-[11px] font-mono uppercase tracking-[0.2em] hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {phase === "sealed" ? (
          <div className="space-y-2">
            <div className="rounded-md border border-emerald/30 bg-emerald/5 p-4 flex items-center gap-3">
              <span className="h-7 w-7 rounded-full bg-emerald/20 text-emerald flex items-center justify-center">
                OK
              </span>
              <div className="flex-1">
                <div className="text-[13px] font-medium">Bid sealed</div>
                {arciumPayload && (
                  <div className="text-[11px] font-mono text-emerald">
                    commit / {arciumPayload.commitmentHash.slice(0, 10)}... / {activeMode}
                  </div>
                )}
                <div className="text-[11px] font-mono text-muted-foreground">
                  The encrypted payload is queued for settlement at auction close.
                </div>
              </div>
            </div>
            <button
              onClick={reset}
              className="w-full h-10 rounded-md border border-hairline text-[12px] hover:border-foreground/30"
            >
              Submit another
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={submit}
              disabled={!wallet.connected || disabled || !bid}
              className="relative w-full h-12 rounded-md bg-emerald text-background font-medium text-[14px] hover:bg-emerald/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
            >
              {!wallet.connected && "Connect wallet to bid"}
              {wallet.connected && resolved && "Auction settled"}
              {wallet.connected && !resolved && insufficient && "Get cSOL before bidding"}
              {wallet.connected &&
                !resolved &&
                !insufficient &&
                phase === "idle" &&
                "Seal & Submit Bid"}
              {wallet.connected && !resolved && !insufficient && phase === "error" && "Retry"}
              {phase === "encrypting" && (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Encrypting locally...
                </span>
              )}
              {phase === "submitting" && (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Broadcasting confidential payload...
                </span>
              )}
              {inProgress && <span className="absolute inset-0 shimmer pointer-events-none" />}
            </button>
            {wallet.connected && insufficient && (
              <Link
                to="/get-csol"
                className="flex h-9 items-center justify-center rounded-md border border-hairline text-[12px] hover:border-emerald/50 transition-colors"
              >
                Get cSOL
              </Link>
            )}
          </div>
        )}

        <p className="text-[11px] text-tertiary leading-relaxed">
          Bid values are encrypted with the Arcium client SDK before they enter local demo state.
          Live MXE metadata is configured on devnet, and sealed-bid or Vickrey settlement will try
          the deployed Arcium path before falling back locally.
        </p>

        {wallet.connected && wallet.address === owner && !resolved && (
          <button
            onClick={onResolve}
            disabled={settling}
            className="w-full h-10 rounded-md border border-electric/40 text-electric text-[12px] hover:border-electric/70 transition-colors"
          >
            {settling ? "Settling escrow..." : "Settle auction"}
          </button>
        )}
      </div>
    </div>
  );
}

function ProgressTrack({ phase }: { phase: Phase }) {
  const steps: { k: Phase | "ready"; l: string }[] = [
    { k: "idle", l: "Compose" },
    { k: "encrypting", l: "Encrypt" },
    { k: "submitting", l: "Broadcast" },
    { k: "sealed", l: "Sealed" },
  ];
  const idx = phase === "error" ? -1 : steps.findIndex((s) => s.k === phase);
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => {
          const active = phase !== "error" && i <= idx;
          const current = phase !== "error" && i === idx;
          return (
            <div
              key={s.k}
              className="flex-1 h-0.5 relative bg-hairline overflow-hidden rounded-full"
            >
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-700 ${active ? "bg-emerald" : "bg-transparent"} ${current ? "w-2/3" : active ? "w-full" : "w-0"}`}
              />
              {current && <div className="absolute inset-0 shimmer" />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
        {steps.map((s, i) => (
          <span key={s.k} className={i === idx ? "text-emerald" : ""}>
            {s.l}
          </span>
        ))}
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-tertiary uppercase tracking-[0.18em] text-[10px]">{k}</span>
      <span className={`tabular ${accent ? "text-emerald" : "text-foreground/90"}`}>{v}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MobileBidBar({
  phase,
  bid,
  reserve,
  onOpen,
}: {
  phase: Phase;
  bid: string;
  reserve: string;
  onOpen: () => void;
}) {
  const wallet = useWallet();
  const label =
    phase === "sealed"
      ? "Bid sealed"
      : phase === "encrypting"
        ? "Encrypting..."
        : phase === "submitting"
          ? "Broadcasting..."
          : !wallet.connected
            ? "Connect & bid"
            : bid
              ? `Seal bid / cSOL ${bid}`
              : "Place sealed bid";

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 hairline-t bg-background/95 backdrop-blur-xl">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tertiary">
            Reserve
          </div>
          <div className="font-mono tabular text-[13px]">{reserve}</div>
        </div>
        <button
          onClick={onOpen}
          className="flex-1 h-11 rounded-md bg-emerald text-background font-medium text-[13.5px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          {(phase === "encrypting" || phase === "submitting") && <Spinner />}
          {label}
        </button>
      </div>
    </div>
  );
}

/* â”€â”€ Live activity feed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

type EventKind = "create" | "bid" | "arcium" | "settle";
type Event = { id: string; t: string; kind: EventKind; actor: string; msg: string; meta?: string };

const KINDS: { k: EventKind | "all"; l: string }[] = [
  { k: "all", l: "All" },
  { k: "create", l: "Created" },
  { k: "bid", l: "Sealed bids" },
  { k: "arcium", l: "Arcium" },
  { k: "settle", l: "Settlement" },
];

function eventTime(value?: string) {
  if (!value) return "--:--:--";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(11, 19) : "--:--:--";
}

function ActivityFeed({ auction }: { auction: MarketAuction }) {
  const market = useMarket();
  const [filter, setFilter] = useState<EventKind | "all">("all");
  const events = useMemo<Event[]>(() => {
    const auctionBids = market.commitments.filter((bid) => bid.auctionId === auction.id);
    const next: Event[] = [
      {
        id: `${auction.id}-created`,
        t: eventTime(auction.createdAt),
        kind: "create",
        actor: shortAddr(auction.owner),
        msg: "Auction created",
        meta: auction.createReceipt?.signature ?? auction.lot,
      },
    ];

    if (auction.mintSignature) {
      next.push({
        id: `${auction.id}-minted`,
        t: eventTime(auction.createdAt),
        kind: "create",
        actor: shortAddr(auction.owner),
        msg: "Lot minted on devnet",
        meta: auction.mintSignature,
      });
    }

    for (const bid of auctionBids) {
      next.push({
        id: `${bid.id}-sealed`,
        t: eventTime(bid.createdAt),
        kind: "bid",
        actor: shortAddr(bid.bidder),
        msg: "Encrypted bid sealed",
        meta: bid.receipt?.signature ?? "+1 sealed",
      });

      if (bid.escrow) {
        next.push({
          id: `${bid.id}-escrow`,
          t: eventTime(bid.createdAt),
          kind: "settle",
          actor: shortAddr(bid.bidder),
          msg: "cSOL moved to auction escrow",
          meta: bid.escrow.signature,
        });
      }

      if (bid.receipt?.arcium) {
        next.push({
          id: `${bid.id}-arcium`,
          t: eventTime(bid.createdAt),
          kind: "arcium",
          actor: "Arcium client",
          msg: "Encrypted payload prepared",
          meta: `${bid.receipt.arcium.mode} / ${bid.receipt.arcium.commitmentHash.slice(0, 10)}`,
        });
      }
    }

    if (auction.resolved) {
      next.push({
        id: `${auction.id}-settled`,
        t: eventTime(new Date().toISOString()),
        kind: "settle",
        actor: "Auction owner",
        msg: auction.winner ? `Winner ${shortAddr(auction.winner)}` : "Settled with no bids",
        meta: auction.clearingPrice ?? "No bids",
      });

      for (const transfer of auction.settlement ?? []) {
        next.push({
          id: `${auction.id}-${transfer.kind}-${transfer.recipient}`,
          t: eventTime(new Date().toISOString()),
          kind: transfer.kind === "lot-transfer" ? "settle" : "bid",
          actor: shortAddr(transfer.recipient),
          msg:
            transfer.kind === "seller-proceeds"
              ? "Seller paid in cSOL"
              : transfer.kind === "bid-refund"
                ? "Refund sent to losing bidder"
                : "Lot transferred to winner",
          meta: transfer.signature,
        });
      }
    }

    return next.sort((a, b) => b.t.localeCompare(a.t));
  }, [auction, market.commitments]);

  const filtered = useMemo(
    () => events.filter((e) => filter === "all" || e.kind === filter),
    [events, filter],
  );

  return (
    <div
      className="rounded-lg border border-hairline bg-surface"
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      <div className="px-5 py-4 hairline-b flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="font-display text-[18px]">Live activity</div>
          <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
            Session log
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary hidden sm:inline">
            Bid amounts hidden
          </span>
        </div>
      </div>

      <div className="px-5 py-2.5 hairline-b flex items-center gap-1.5 overflow-x-auto">
        {KINDS.map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`shrink-0 h-7 px-2.5 rounded-md text-[11px] font-mono uppercase tracking-[0.16em] border transition-colors ${
              filter === f.k
                ? "bg-surface-elevated border-foreground/20 text-foreground"
                : "border-hairline text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <ul className="max-h-[360px] overflow-y-auto divide-y divide-[var(--hairline)] font-mono text-[12.5px]">
        {filtered.length === 0 && (
          <li className="px-5 py-10 text-center text-tertiary text-[12px]">
            No events for this filter.
          </li>
        )}
        {filtered.map((e) => (
          <li
            key={e.id}
            className="group px-5 py-3 grid grid-cols-12 gap-3 items-center hover:bg-surface-elevated/40 transition-colors animate-in fade-in slide-in-from-top-1 duration-300 relative"
          >
            <span className="col-span-3 sm:col-span-2 tabular text-tertiary">{e.t}</span>
            <span className="col-span-4 sm:col-span-3 truncate">{e.actor}</span>
            <span className="col-span-3 sm:col-span-5 text-muted-foreground flex items-center gap-2 truncate">
              <KindDot k={e.kind} />
              <span className="truncate">{e.msg}</span>
            </span>
            <span className="col-span-2 text-right text-[11px] text-emerald truncate">
              {e.meta}
            </span>
            <div className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none z-10">
              <div className="rounded-md border border-hairline bg-popover px-3 py-2 text-[11px] shadow-lg">
                <div className="text-tertiary uppercase tracking-[0.18em] text-[9px]">
                  Reference
                </div>
                <div className="text-foreground/90">{e.id}</div>
                <div className="mt-1 text-tertiary">
                  Captured from live auction actions in this session
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
function KindDot({ k }: { k: EventKind }) {
  const cls =
    k === "bid"
      ? "bg-emerald"
      : k === "arcium"
        ? "bg-electric"
        : k === "settle"
          ? "bg-foreground/70"
          : "bg-emerald";
  return <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cls}`} />;
}
