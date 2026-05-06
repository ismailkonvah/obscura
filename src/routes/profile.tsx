import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/obscura/Nav";
import { Footer } from "@/components/obscura/Footer";
import { useMarket } from "@/components/obscura/MarketContext";
import { useWallet, shortAddr } from "@/components/obscura/WalletContext";
import { mintDevnetDemoLot } from "@/lib/devnetTokens";
import { useState } from "react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const wallet = useWallet();
  const market = useMarket();
  const myAuctions = market.auctions.filter((a) => a.owner === wallet.address);
  const myBids = market.commitments.filter((b) => b.bidder === wallet.address);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  async function mintLot() {
    if (!wallet.address) {
      setMintError("Connect a devnet wallet before minting a demo lot.");
      return;
    }
    setMintError(null);
    setMinting(true);
    try {
      const receipt = await mintDevnetDemoLot({
        owner: wallet.address,
        signAndSendTransaction: wallet.signAndSendTransaction,
      });
      market.mintDemoLot(receipt);
      await wallet.refreshBalance();
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Unable to mint demo lot on devnet.");
    } finally {
      setMinting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="mx-auto max-w-[1400px] px-6 lg:px-10 pt-16">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
              Profile - devnet desk
            </div>
            <h1 className="mt-3 font-display text-[52px] leading-[0.95] tracking-[-0.02em]">
              Your private market desk.
            </h1>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Track created auctions, optional saved lots, encrypted commitments, and settlement
              results. The fastest path is now Create Auction, where a lot is minted automatically.
            </p>
          </div>
          <button
            onClick={mintLot}
            disabled={minting}
            className="h-11 px-5 rounded-md bg-emerald text-background text-[14px] font-medium disabled:opacity-50"
          >
            {minting ? "Minting on devnet..." : "Mint sample lot"}
          </button>
        </div>
        {mintError && <div className="mt-4 text-sm text-destructive">{mintError}</div>}

        <div className="mt-10 grid md:grid-cols-4 gap-px bg-hairline border border-hairline">
          <Stat
            label="Wallet"
            value={wallet.connected ? shortAddr(wallet.address) : "Disconnected"}
          />
          <Stat label="Owned lots" value={market.ownedLots.length.toString()} />
          <Stat label="Created auctions" value={myAuctions.length.toString()} />
          <Stat label="Encrypted bids" value={myBids.length.toString()} />
        </div>

        <section className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-[32px]">Owned lots</h2>
            <Link
              to="/create-auction"
              className="h-9 px-4 inline-flex items-center rounded-md bg-emerald text-background text-[13px] font-medium"
            >
              Create auction
            </Link>
          </div>
          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {market.ownedLots.map((lot) => (
              <div
                key={lot.id}
                className="rounded-lg border border-hairline bg-surface overflow-hidden"
              >
                <img src={lot.image} alt={lot.title} className="aspect-[4/3] w-full object-cover" />
                <div className="p-4">
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
                    {lot.collection}
                  </div>
                  <div className="mt-1 font-display text-[20px]">{lot.title}</div>
                  {lot.mint && (
                    <div className="mt-3 rounded-md border border-hairline bg-background p-2 font-mono text-[10px] text-muted-foreground">
                      <div className="text-emerald">on-chain SPL lot</div>
                      <div className="mt-1 break-all">mint {lot.mint}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-[32px]">Your encrypted commitments</h2>
          <div className="mt-5 rounded-lg border border-hairline bg-surface overflow-hidden">
            {myBids.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No private bids yet.</div>
            ) : (
              myBids.map((bid) => {
                const auction = market.auctions.find((item) => item.id === bid.auctionId);
                const won = auction?.winner === wallet.address;
                const settled = Boolean(auction?.resolved);
                const refund = auction?.settlement?.find(
                  (transfer) =>
                    transfer.kind === "bid-refund" && transfer.recipient === wallet.address,
                );
                const lotTransfer = auction?.settlement?.find(
                  (transfer) =>
                    transfer.kind === "lot-transfer" && transfer.recipient === wallet.address,
                );
                const status = !settled ? "Pending reveal" : won ? "Won" : "Refunded";
                const statusClass = !settled
                  ? "text-tertiary"
                  : won
                    ? "text-emerald"
                    : "text-electric";

                return (
                  <div key={bid.id} className="px-5 py-4 hairline-b">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-display text-[18px] truncate">
                          {auction?.title ?? bid.auctionId}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-tertiary">
                          {auction?.lot ?? bid.auctionId} / sealed cSOL bid
                        </div>
                      </div>
                      <div
                        className={`font-mono text-[12px] uppercase tracking-[0.16em] ${statusClass}`}
                      >
                        {status}
                      </div>
                    </div>

                    <div className="mt-4 grid sm:grid-cols-4 gap-px bg-hairline border border-hairline">
                      <MiniStat label="Bid" value={`cSOL ${bid.amount.toFixed(2)}`} />
                      <MiniStat label="Result" value={auction?.clearingPrice ?? "Hidden"} />
                      <MiniStat
                        label="Escrow"
                        value={bid.escrow ? shortAddr(bid.escrow.tokenAccount) : "None"}
                      />
                      <MiniStat
                        label="Settlement"
                        value={
                          lotTransfer
                            ? "Lot received"
                            : refund
                              ? `Refund cSOL ${refund.amount?.toFixed(2) ?? ""}`
                              : settled
                                ? "No transfer"
                                : "Awaiting close"
                        }
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-mono text-muted-foreground">
                      <Link
                        to="/auctions/$id"
                        params={{ id: bid.auctionId }}
                        className="text-emerald"
                      >
                        View auction
                      </Link>
                      {bid.receipt?.arcium && (
                        <span>commit {bid.receipt.arcium.commitmentHash.slice(0, 12)}...</span>
                      )}
                      {lotTransfer && <span>lot tx {lotTransfer.signature}</span>}
                      {refund && <span>refund tx {refund.signature}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3 py-2">
      <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-tertiary">{label}</div>
      <div className="mt-1 font-mono text-[12px] tabular break-all">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-5 py-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">{label}</div>
      <div className="mt-1 font-mono text-[14px] tabular break-all">{value}</div>
    </div>
  );
}
