import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export type Auction = {
  id: string;
  title: string;
  lot: string;
  image: string;
  type: "Sealed-Bid" | "Uniform Price" | "Vickrey" | "Dutch";
  reserve: string;
  bidders: number;
  ends: string; // e.g. "02:14:38"
  status: "live" | "settling" | "soon";
  encryptedBids: number;
  closesAt?: string;
  resolved?: boolean;
};

export function AuctionCard({ a }: { a: Auction }) {
  const seed = a.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const depth = useMemo(
    () => Array.from({ length: 12 }, (_, i) => 28 + ((seed + i * 17) % 54)),
    [seed],
  );
  const countdown = useAuctionCountdown(a.closesAt, a.ends);
  const status = a.resolved
    ? "settled"
    : countdown.totalSeconds === 0 && a.status === "live"
      ? "settling"
      : a.status;

  return (
    <Link
      to="/auctions/$id"
      params={{ id: a.id }}
      className="group block rounded-lg bg-surface hairline-t border border-hairline overflow-hidden hover:border-emerald/30 hover:-translate-y-1 transition-all duration-300"
      style={{ boxShadow: "var(--shadow-elevated)" }}
      aria-label={`Enter auction ${a.title}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-background">
        <img
          src={a.image}
          alt={a.title}
          loading="lazy"
          className="h-full w-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
        <div className="absolute inset-0 cipher-rain opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="px-2 py-1 rounded-sm bg-background/80 backdrop-blur text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground border border-hairline">
            {a.type}
          </span>
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-sm bg-background/80 backdrop-blur border border-hairline">
          <span
            className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-emerald pulse-dot" : status === "settling" ? "bg-electric" : status === "settled" ? "bg-foreground/70" : "bg-tertiary"}`}
          />
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            {status === "live"
              ? "Bidding"
              : status === "settling"
                ? "Ready to settle"
                : status === "settled"
                  ? "Settled"
                  : "Opens soon"}
          </span>
        </div>
        <div className="absolute left-3 right-3 bottom-3 rounded-md border border-hairline bg-background/75 backdrop-blur px-3 py-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          <div className="flex h-10 items-end gap-1">
            {depth.map((h, i) => (
              <span
                key={i}
                className={`flex-1 depth-rise ${i < 7 ? "bg-emerald/70" : "bg-electric/45"}`}
                style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.18em] text-tertiary">
            <span>Encrypted demand</span>
            <span>{a.encryptedBids + 12} packets/min</span>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
              Lot · {a.lot}
            </div>
            <h3 className="mt-1 font-display text-[18px] leading-tight truncate">{a.title}</h3>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
              Ends in
            </div>
            <div className="font-mono tabular text-[15px] mt-0.5">{countdown.label}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 pt-4 hairline-t">
          <Stat label="Reserve" value={a.reserve} accent />
          <Stat label="Bidders" value={a.bidders.toString()} />
          <Stat label="Sealed" value={`◐ ${a.encryptedBids}`} mono />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 12h16M12 4v16" />
            </svg>
            Bids encrypted client-side
          </div>
          <span className="inline-flex h-8 items-center rounded-md bg-emerald px-3 text-[12px] font-medium text-background group-hover:translate-x-0.5 transition-transform">
            Enter →
          </span>
        </div>
      </div>
    </Link>
  );
}

function useAuctionCountdown(closesAt: string | undefined, fallbackEnds: string) {
  const initialSeconds = useMemo(() => {
    if (closesAt) {
      const closeMs = new Date(closesAt).getTime();
      if (Number.isFinite(closeMs)) return Math.max(0, Math.ceil((closeMs - Date.now()) / 1000));
    }
    const [h = 0, m = 0, s = 0] = fallbackEnds.split(":").map(Number);
    return Math.max(0, h * 3600 + m * 60 + s);
  }, [closesAt, fallbackEnds]);
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);

  useEffect(() => {
    function sync() {
      if (closesAt) {
        const closeMs = new Date(closesAt).getTime();
        setTotalSeconds(
          Number.isFinite(closeMs) ? Math.max(0, Math.ceil((closeMs - Date.now()) / 1000)) : 0,
        );
      } else {
        setTotalSeconds((seconds) => Math.max(0, seconds - 1));
      }
    }
    sync();
    const timer = window.setInterval(sync, 1000);
    return () => window.clearInterval(timer);
  }, [closesAt]);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return { label: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, totalSeconds };
}

function Stat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">{label}</div>
      <div
        className={`mt-1 tabular ${mono ? "font-mono text-[13px]" : "font-mono text-[14px]"} ${accent ? "text-foreground" : "text-foreground/90"}`}
      >
        {value}
      </div>
    </div>
  );
}
