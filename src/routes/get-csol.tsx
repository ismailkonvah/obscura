import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Nav } from "@/components/obscura/Nav";
import { Footer } from "@/components/obscura/Footer";
import { useMarket } from "@/components/obscura/MarketContext";
import { useWallet } from "@/components/obscura/WalletContext";
import {
  getDevnetCsolBalance,
  unwrapCsolToSol,
  wrapSolToCsol,
  type TokenMintReceipt,
} from "@/lib/devnetTokens";

export const Route = createFileRoute("/get-csol")({
  component: GetConfidentialSol,
});

function GetConfidentialSol() {
  const wallet = useWallet();
  const market = useMarket();
  const [amount, setAmount] = useState("1");
  const [pending, setPending] = useState<"wrap" | "withdraw" | null>(null);
  const [receipt, setReceipt] = useState<TokenMintReceipt | null>(null);
  const [receiptAction, setReceiptAction] = useState<"Wrapped" | "Withdrawn">("Wrapped");
  const [error, setError] = useState<string | null>(null);
  const parsedAmount = parseFloat(amount);
  const canWithdraw =
    wallet.connected &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= market.confidentialBalance;

  async function wrapCsol() {
    if (!wallet.address) {
      setError("Connect a devnet wallet before wrapping SOL.");
      return;
    }
    const parsed = parsedAmount;
    setError(null);
    setPending("wrap");
    try {
      const nextReceipt = await wrapSolToCsol({
        owner: wallet.address,
        amount: parsed,
        signAndSendTransaction: wallet.signAndSendTransaction,
      });
      await wallet.refreshBalance();
      const snapshot = await getDevnetCsolBalance(wallet.address);
      market.setConfidentialBalance(snapshot.balance);
      setReceiptAction("Wrapped");
      setReceipt(nextReceipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to wrap SOL into cSOL on devnet.");
    } finally {
      setPending(null);
    }
  }

  async function withdrawSol() {
    if (!wallet.address) {
      setError("Connect a devnet wallet before withdrawing SOL.");
      return;
    }
    const parsed = parsedAmount;
    if (!canWithdraw) {
      setError("Enter an amount within your private cSOL balance.");
      return;
    }
    setError(null);
    setPending("withdraw");
    try {
      const nextReceipt = await unwrapCsolToSol({
        owner: wallet.address,
        amount: parsed,
        signAndSendTransaction: wallet.signAndSendTransaction,
      });
      await wallet.refreshBalance();
      const snapshot = await getDevnetCsolBalance(wallet.address);
      market.setConfidentialBalance(snapshot.balance);
      setReceiptAction("Withdrawn");
      setReceipt(nextReceipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to withdraw SOL on devnet.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="mx-auto max-w-[1100px] px-6 lg:px-10 pt-16">
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
          Set up confidential bidding balance
        </div>
        <h1 className="mt-3 font-display text-[52px] leading-[0.95] tracking-[-0.02em]">
          Wrap SOL into cSOL for private bids.
        </h1>
        <p className="mt-5 max-w-xl text-muted-foreground">
          Obscura keeps the blind auction thesis intact: bids are encrypted before close, and only
          the final result is revealed. cSOL is a 1:1 devnet wrapper for SOL used to fund
          confidential bid commitments.
        </p>

        <div className="mt-10 grid lg:grid-cols-2 gap-6">
          <section className="rounded-lg border border-hairline bg-surface p-6">
            <div className="font-display text-[24px]">Devnet wallet</div>
            <div className="mt-5 grid grid-cols-2 gap-px bg-hairline border border-hairline">
              <Stat label="Wallet" value={wallet.connected ? "Connected" : "Disconnected"} />
              <Stat
                label="Devnet SOL"
                value={wallet.connected ? wallet.balance.toFixed(4) : "0.0000"}
              />
              <Stat label="Private cSOL" value={market.confidentialBalance.toFixed(4)} />
              <Stat label="Network" value="Solana devnet" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={wallet.connect}
                className="h-10 px-4 rounded-md bg-emerald text-background text-[13px] font-medium"
              >
                {wallet.connected ? "Wallet connected" : "Connect wallet"}
              </button>
              <button
                onClick={wallet.requestAirdrop}
                disabled={!wallet.connected || wallet.airdropping}
                className="h-10 px-4 rounded-md border border-hairline text-[13px] disabled:opacity-50"
              >
                {wallet.airdropping ? "Requesting..." : "Request devnet SOL"}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-hairline bg-surface p-6">
            <div className="font-display text-[24px]">Wrap or withdraw cSOL</div>
            <label className="mt-5 block">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
                Amount in SOL
              </span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="mt-2 h-12 w-full rounded-md border border-hairline bg-background px-4 font-mono text-[20px] outline-none focus:border-emerald/60"
              />
            </label>
            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <button
                onClick={wrapCsol}
                disabled={!wallet.connected || pending !== null}
                className="h-11 rounded-md bg-emerald text-background text-[14px] font-medium disabled:opacity-50"
              >
                {pending === "wrap" ? "Wrapping..." : "Wrap 1:1"}
              </button>
              <button
                onClick={withdrawSol}
                disabled={!canWithdraw || pending !== null}
                className="h-11 rounded-md border border-hairline text-[14px] font-medium disabled:opacity-50"
              >
                {pending === "withdraw" ? "Withdrawing..." : "Withdraw SOL"}
              </button>
            </div>
            {error && <div className="mt-4 text-[12px] text-destructive">{error}</div>}
            {receipt && (
              <div className="mt-4 rounded-md border border-hairline bg-background p-3 text-[11px] font-mono text-muted-foreground">
                <div className="text-emerald">{receiptAction} on devnet</div>
                <div className="mt-1 break-all">mint {receipt.mint}</div>
                <div className="mt-1 break-all">ata {receipt.tokenAccount}</div>
                {receipt.vault && <div className="mt-1 break-all">vault {receipt.vault}</div>}
                <div className="mt-1 break-all">tx {receipt.signature}</div>
              </div>
            )}
            <p className="mt-4 text-[12px] text-tertiary leading-relaxed">
              Wrap deposits devnet SOL into a local demo vault and mints the same amount of cSOL.
              Withdraw burns cSOL and returns SOL from that vault. A production Arcium/Solana build
              would replace the local vault key with a program-owned vault or PDA.
            </p>
          </section>
        </div>

        <Link
          to="/auctions"
          className="mt-10 inline-flex h-10 items-center rounded-md border border-hairline px-4 text-[13px]"
        >
          Browse auctions
        </Link>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">{label}</div>
      <div className="mt-1 font-mono text-[13px] tabular break-all">{value}</div>
    </div>
  );
}
