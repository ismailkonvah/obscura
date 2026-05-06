import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/obscura/Nav";
import { Footer } from "@/components/obscura/Footer";
import { AuctionCard } from "@/components/obscura/AuctionCard";
import { useMarket } from "@/components/obscura/MarketContext";

export const Route = createFileRoute("/auctions")({
  head: () => ({
    meta: [
      { title: "Live Auctions — Obscura" },
      {
        name: "description",
        content: "Browse live confidential auctions. Sealed bids, fair settlement on Solana.",
      },
    ],
  }),
  component: AuctionsPage,
});

function AuctionsPage() {
  const { auctions, loaded, resetDemoMarket } = useMarket();

  function resetMarket() {
    if (
      window.confirm(
        "Clear local demo auctions, owned lots, and bid commitments? Your devnet wallet and cSOL token balance will stay untouched.",
      )
    ) {
      resetDemoMarket();
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <section className="mx-auto max-w-[1400px] px-6 lg:px-10 pt-16">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
              Marketplace · Solana devnet
            </div>
            <h1 className="mt-3 font-display text-[56px] leading-[0.95] tracking-[-0.02em]">
              Auctions
            </h1>
            <p className="mt-4 text-muted-foreground max-w-md">
              All bids encrypted. Settlement verified on Solana via Arcium MPC.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {["All", "Sealed-Bid", "Vickrey", "Uniform"].map((f, i) => (
              <button
                key={f}
                className={`h-8 px-3 rounded-md text-[12px] font-mono uppercase tracking-[0.16em] border ${i === 0 ? "bg-surface-elevated border-foreground/20 text-foreground" : "border-hairline text-muted-foreground hover:text-foreground"}`}
              >
                {f}
              </button>
            ))}
            {loaded && auctions.length > 0 && (
              <button
                onClick={resetMarket}
                className="h-8 px-3 rounded-md text-[12px] font-mono uppercase tracking-[0.16em] border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
              >
                Reset demo
              </button>
            )}
          </div>
        </div>

        {!loaded ? (
          <div className="mt-12 rounded-lg border border-hairline bg-surface p-8 sm:p-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
              Loading live auctions
            </div>
            <h2 className="mt-3 font-display text-[34px] leading-tight">
              Restoring your devnet market.
            </h2>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {auctions.map((a) => (
              <AuctionCard key={a.id} a={a} />
            ))}
          </div>
        )}

        {loaded && auctions.length === 0 && (
          <div className="mt-12 rounded-lg border border-hairline bg-surface p-8 sm:p-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
              No live auctions
            </div>
            <h2 className="mt-3 font-display text-[34px] leading-tight">Your market is clean.</h2>
            <p className="mt-3 max-w-lg text-[14px] text-muted-foreground leading-relaxed">
              Mint a devnet lot, create a sealed-bid, Vickrey, or uniform-price auction, then this
              desk will show only auctions created through Obscura.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/profile"
                className="inline-flex h-10 items-center rounded-md border border-hairline px-4 text-[13px] hover:border-emerald/50 transition-colors"
              >
                Mint demo lot
              </Link>
              <Link
                to="/create-auction"
                className="inline-flex h-10 items-center rounded-md bg-emerald px-4 text-[13px] font-medium text-background"
              >
                Create auction
              </Link>
            </div>
          </div>
        )}

        <div className="mt-16 text-center">
          <Link
            to="/"
            className="text-[12px] font-mono uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </section>
      <Footer />
    </div>
  );
}
