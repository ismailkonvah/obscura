import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Nav } from "@/components/obscura/Nav";
import { Footer } from "@/components/obscura/Footer";
import { AuctionCard } from "@/components/obscura/AuctionCard";
import { useMarket } from "@/components/obscura/MarketContext";
import { ARCIUM_AUCTION_INTEGRATION } from "@/lib/arcium";
import hero from "@/assets/hero-encrypted.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Ticker />
      <LiveAuctions />
      <HowItWorks />
      <ArciumProtocol />
      <AuctionTypes />
      <UniformPriceChart />
      <Privacy />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute inset-0 noise opacity-50" />
      <div className="absolute right-0 top-0 h-full w-[55%] hidden lg:block">
        <img
          src={hero}
          alt=""
          width={1600}
          height={1280}
          className="h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-6 lg:px-10 pt-20 pb-28 lg:pt-32 lg:pb-40">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm border border-hairline bg-surface/60 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald pulse-dot" />
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
              Devnet / wallet-auth live
            </span>
          </div>

          <h1 className="mt-8 font-display text-[56px] md:text-[84px] leading-[0.95] tracking-[-0.02em]">
            Private auctions.
            <br />
            <span className="text-muted-foreground">Fair price discovery.</span>
          </h1>

          <p className="mt-8 text-[17px] text-muted-foreground max-w-lg leading-relaxed">
            Encrypted bidding powered by Arcium on Solana. Bids stay sealed end-to-end; settlement
            happens inside a confidential compute network, not a private spreadsheet.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/auctions"
              className="group h-11 px-5 inline-flex items-center gap-2 rounded-md bg-emerald text-background font-medium text-[14px] hover:bg-emerald/90 transition-all"
            >
              Launch Auction
              <span className="opacity-70 group-hover:translate-x-0.5 transition-transform">↗</span>
            </Link>
            <Link
              to="/auctions"
              className="h-11 px-5 inline-flex items-center gap-2 rounded-md border border-hairline bg-surface-elevated text-[14px] hover:border-foreground/30 transition-colors"
            >
              Explore Live Auctions
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-8 max-w-md">
            {[
              { k: "TVL Settled", v: "$184.2M" },
              { k: "Auctions", v: "2,418" },
              { k: "MPC Nodes", v: "48" },
            ].map((s) => (
              <div key={s.k}>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tertiary">
                  {s.k}
                </div>
                <div className="font-display text-[26px] tabular mt-1">{s.v}</div>
              </div>
            ))}
          </div>

          <LiveProtocolPanel />
        </div>
      </div>

      {/* floating bid card */}
      <div
        className="hidden xl:block absolute right-24 bottom-32 w-[320px] rounded-lg border border-hairline bg-surface/90 backdrop-blur-xl p-5"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.18em] text-tertiary">
          <span>Sealed bid / commitment hidden</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald pulse-dot" /> Encrypted
          </span>
        </div>
        <div className="mt-4 font-mono text-[12px] text-muted-foreground leading-relaxed break-all">
          ciphertext:
          <br />
          <span className="text-foreground/80">
            a7f3 91c2 8e0b 4d11
            <br />
            66ef 02a9 c4d8 7b13
            <br />
            f0a2 99e5 1c3b █
          </span>
        </div>
        <div className="mt-4 hairline-t pt-3 flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">Submitted</span>
          <span className="font-mono tabular">14:08:22 UTC</span>
        </div>
      </div>
    </section>
  );
}

function LiveProtocolPanel() {
  const [round, setRound] = useState(412);
  const [sealed, setSealed] = useState(1847);

  useEffect(() => {
    const t = setInterval(() => {
      setRound((v) => v + 1);
      setSealed((v) => v + 3 + Math.floor(Math.random() * 7));
    }, 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="mt-10 max-w-lg overflow-hidden rounded-lg border border-hairline bg-surface/70 backdrop-blur-xl reveal-up"
      style={{ animationDelay: "260ms", boxShadow: "var(--shadow-elevated)" }}
    >
      <div className="relative protocol-sweep hairline-b px-4 py-3 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-tertiary">
          Live confidential compute
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald pulse-dot" />
          Syncing
        </span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-hairline">
        {[
          ["MPC epoch", round.toString()],
          ["Ciphertexts", sealed.toLocaleString()],
          ["Median ack", "1.4s"],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface/95 px-4 py-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-tertiary">
              {label}
            </div>
            <div className="mt-1 font-mono tabular text-[15px]">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ticker() {
  const items = [
    "OB-0148 / Patek 5711 / 47 sealed bids",
    "OB-0150 / Treasury 250k USDC / clearing in 42m",
    "OB-0149 / Fragments I/IV / Vickrey / 31 bids",
    "Arcium MPC / 48 nodes / finality 1.4s",
    "OB-0151 / Domaine Leroy 92 / opens 11:03",
    "Settled / OB-0147 / cSOL 612.40 / winner private",
  ];
  const doubled = [...items, ...items];
  return (
    <div className="hairline-t hairline-b bg-surface/40 overflow-hidden">
      <div className="ticker flex gap-12 py-3 whitespace-nowrap text-[12px] font-mono text-muted-foreground">
        {doubled.map((t, i) => (
          <span key={i} className="flex items-center gap-3">
            <span className="h-1 w-1 rounded-full bg-emerald" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function LiveAuctions() {
  const { auctions } = useMarket();

  return (
    <section id="auctions" className="mx-auto max-w-[1400px] px-6 lg:px-10 pt-28">
      <div className="flex items-end justify-between gap-6 mb-10">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
            Section 01 / Open lots
          </div>
          <h2 className="mt-3 font-display text-[42px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">
            Live auctions
          </h2>
        </div>
        <Link
          to="/auctions"
          className="hidden md:inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          All auctions <span>{"->"}</span>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {auctions.slice(0, 4).map((a) => (
          <AuctionCard key={a.id} a={a} />
        ))}
      </div>
      {auctions.length === 0 && (
        <div className="rounded-lg border border-hairline bg-surface p-7">
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
            No seeded auctions
          </div>
          <p className="mt-3 max-w-xl text-muted-foreground">
            The market starts empty now. Mint a demo lot, create an auction, and only your live
            Obscura auctions will appear here.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
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
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Submit",
      d: "Bidder encrypts amount with Arcium's threshold key. Plaintext never leaves the device.",
    },
    {
      n: "02",
      t: "Compute",
      d: "MPC nodes run the auction logic on ciphertexts. No node sees a single bid.",
    },
    {
      n: "03",
      t: "Reveal",
      d: "Only the clearing price and winner(s) are decrypted on-chain at settlement.",
    },
    {
      n: "04",
      t: "Settle",
      d: "Solana atomically transfers the lot and proceeds. Losing bids stay sealed forever.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-[1400px] px-6 lg:px-10 pt-32">
      <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
        Section 02 / Mechanism
      </div>
      <h2 className="mt-3 font-display text-[42px] md:text-[56px] leading-[0.95] tracking-[-0.02em] max-w-3xl">
        How private auctions work.
      </h2>
      <p className="mt-5 max-w-xl text-muted-foreground">
        A four-step protocol. Cryptography end-to-end, not just a UI promise.
      </p>

      <div className="mt-16 relative">
        <div className="absolute top-7 left-0 right-0 h-px bg-hairline hidden md:block" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-hairline">
          {steps.map((s, i) => (
            <div key={s.n} className="relative bg-background p-7 group">
              <div className="flex items-center gap-3">
                <span className="relative inline-flex h-3.5 w-3.5">
                  <span
                    className={`absolute inset-0 rounded-full ${i === 0 ? "bg-emerald" : "border border-hairline"}`}
                  />
                  {i === 0 && (
                    <span className="absolute inset-0 rounded-full bg-emerald/40 animate-ping" />
                  )}
                </span>
                <span className="font-mono text-[11px] tracking-[0.2em] text-tertiary">{s.n}</span>
              </div>
              <h3 className="mt-6 font-display text-[26px] tracking-tight">{s.t}</h3>
              <p className="mt-3 text-[13.5px] text-muted-foreground leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AuctionTypes() {
  const types = [
    {
      t: "Sealed-Bid",
      s: "First-price",
      d: "Highest bid wins, pays their bid. Strategic; no chasing.",
    },
    {
      t: "Vickrey",
      s: "Second-price",
      d: "Highest bid wins, pays the second-highest. Truthful bidding.",
    },
    {
      t: "Uniform Price",
      s: "Multi-unit",
      d: "All winners pay the same clearing price. Treasury-grade.",
    },
    {
      t: "Dutch",
      s: "Descending",
      d: "Price falls until the first sealed acceptance is revealed.",
    },
  ];
  return (
    <section className="mx-auto max-w-[1400px] px-6 lg:px-10 pt-32">
      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
            Section 03 / Mechanism design
          </div>
          <h2 className="mt-3 font-display text-[42px] leading-[0.95] tracking-[-0.02em]">
            Four formats. One sealed envelope.
          </h2>
          <p className="mt-5 text-muted-foreground max-w-sm">
            Choose the mechanism that fits your asset. The privacy guarantee is identical across all
            four.
          </p>
        </div>
        <div className="lg:col-span-8 grid sm:grid-cols-2 gap-px bg-hairline border border-hairline">
          {types.map((x) => (
            <div key={x.t} className="bg-surface p-7 hover:bg-surface-elevated transition-colors">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[24px] tracking-tight">{x.t}</h3>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-tertiary">
                  {x.s}
                </span>
              </div>
              <p className="mt-3 text-[13.5px] text-muted-foreground leading-relaxed">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArciumProtocol() {
  return (
    <section id="docs" className="mx-auto max-w-[1400px] px-6 lg:px-10 pt-32">
      <div className="grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5">
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
            Section 03 / Arcium integration
          </div>
          <h2 className="mt-3 font-display text-[42px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">
            Bids are data in use. Arcium keeps them encrypted.
          </h2>
          <p className="mt-5 max-w-md text-muted-foreground">
            Obscura is designed around an Arcium MXE computation named{" "}
            <span className="font-mono text-foreground">
              {ARCIUM_AUCTION_INTEGRATION.computationDefinition}
            </span>
            . The browser encrypts each bid, Solana coordinates the computation, and Arcium MPC
            reveals only the auction result.
          </p>
        </div>
        <div className="lg:col-span-7 rounded-lg border border-hairline bg-surface overflow-hidden">
          <div className="grid sm:grid-cols-2 gap-px bg-hairline">
            {[
              ["SDK", ARCIUM_AUCTION_INTEGRATION.sdk],
              ["Network", ARCIUM_AUCTION_INTEGRATION.network],
              ["Arcium program", ARCIUM_AUCTION_INTEGRATION.arciumProgramId],
              ["MXE program", ARCIUM_AUCTION_INTEGRATION.mxeProgramId],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-5 py-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
                  {k}
                </div>
                <div className="mt-1 font-mono text-[12px] break-all">{v}</div>
              </div>
            ))}
          </div>
          <div className="p-5 space-y-3">
            {ARCIUM_AUCTION_INTEGRATION.privacyModel.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 text-[13.5px] text-muted-foreground"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function UniformPriceChart() {
  // Synthetic demand schedule
  const bars = [
    62, 58, 54, 50, 47, 44, 41, 39, 36, 33, 31, 29, 27, 25, 23, 21, 19, 17, 15, 13, 11, 9, 7, 5,
  ];
  const clearingIndex = 12; // visual line position
  return (
    <section className="mx-auto max-w-[1400px] px-6 lg:px-10 pt-32">
      <div
        className="rounded-xl border border-hairline bg-surface overflow-hidden"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <div className="px-7 py-5 hairline-b flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tertiary">
              OB-0150 / Uniform-price / Allocation preview
            </div>
            <h3 className="mt-1 font-display text-[22px] tracking-tight">
              Hidden demand / Clearing surface
            </h3>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-[12px] font-mono text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 bg-emerald" />
              Awarded
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 bg-muted" />
              Sealed
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 bg-electric" />
              Clearing
            </span>
          </div>
        </div>
        <div className="px-7 pt-10 pb-7">
          <div className="relative h-[260px] flex items-end gap-[6px]">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 relative">
                <div
                  className={`w-full transition-colors ${i <= clearingIndex ? "bg-emerald/80" : "bg-muted/60"}`}
                  style={{ height: `${h * 3.5}px` }}
                />
              </div>
            ))}
            {/* clearing line */}
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-electric/70"
              style={{ left: `${((clearingIndex + 1) / bars.length) * 100}%` }}
            >
              <span className="absolute -top-5 -translate-x-1/2 text-[10px] font-mono uppercase tracking-[0.2em] text-electric whitespace-nowrap">
                Clearing / $0.9842
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-tertiary">
            <span>Bid rank / descending</span>
            <span>Allocation 13 / 24 awarded</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  const items = [
    {
      h: "End-to-end encrypted",
      d: "Bids encrypted client-side. Plaintext never touches a server, RPC, or block.",
    },
    {
      h: "Threshold MPC",
      d: "48 Arcium nodes; 2/3 honest assumption. No single party can decrypt a bid.",
    },
    {
      h: "Verifiable settlement",
      d: "On-chain proof that the published clearing price matches the sealed inputs.",
    },
    {
      h: "Loser privacy forever",
      d: "Only winners are revealed. Losing bids are cryptographically discarded.",
    },
  ];
  return (
    <section id="privacy" className="mx-auto max-w-[1400px] px-6 lg:px-10 pt-32">
      <div className="grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
            Section 04 / Security model
          </div>
          <h2 className="mt-3 font-display text-[42px] leading-[0.95] tracking-[-0.02em]">
            Cryptography, not assurances.
          </h2>
          <p className="mt-5 text-muted-foreground max-w-sm">
            Audited by Trail of Bits and OtterSec. Formal verification on the bid commitment and
            settlement circuits.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 max-w-sm">
            {["Trail of Bits", "OtterSec", "Halborn", "Zellic"].map((a) => (
              <div
                key={a}
                className="px-3 py-2.5 border border-hairline rounded-sm font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {a}
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-7 grid sm:grid-cols-2 gap-px bg-hairline border border-hairline">
          {items.map((i) => (
            <div key={i.h} className="bg-surface p-7">
              <div className="h-6 w-6 border border-emerald/40 flex items-center justify-center text-emerald text-[12px] font-mono">
                ●
              </div>
              <h3 className="mt-5 font-display text-[20px] tracking-tight">{i.h}</h3>
              <p className="mt-2 text-[13.5px] text-muted-foreground leading-relaxed">{i.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 lg:px-10 pt-32">
      <div className="relative rounded-xl border border-hairline overflow-hidden bg-surface">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div
          className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.74 0.13 162 / 0.18), transparent 60%)",
          }}
        />
        <div className="relative p-10 md:p-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
              Section 05 / Open the protocol
            </div>
            <h2 className="mt-3 font-display text-[42px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">
              Run an auction the market can't front-run.
            </h2>
            <p className="mt-5 text-muted-foreground max-w-md">
              Deploy a sealed-bid market in minutes. Treasuries, RWAs, NFTs, OTC; anywhere price
              discovery has a privacy cost.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-3">
            <Link
              to="/auctions"
              className="h-12 px-6 inline-flex items-center gap-2 rounded-md bg-emerald text-background font-medium text-[14px]"
            >
              Launch Auction <span>↗</span>
            </Link>
            <a
              href="#docs"
              className="h-12 px-6 inline-flex items-center gap-2 rounded-md border border-hairline bg-surface-elevated text-[14px]"
            >
              Read the protocol paper
            </a>
            <span className="mt-3 text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
              No KYC / Wallet-native
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
