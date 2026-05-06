import { Link } from "@tanstack/react-router";
import { WalletButton } from "./WalletButton";
import { useState } from "react";

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 hairline-b">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="relative inline-flex h-5 w-5 items-center justify-center">
            <span className="absolute inset-0 rounded-sm border border-emerald/60" />
            <span className="absolute inset-1 bg-emerald/80" />
          </span>
          <span className="font-display text-[17px] tracking-tight">Obscura</span>
          <span className="hidden md:inline text-[10px] font-mono uppercase tracking-[0.2em] text-tertiary ml-1">
            v0.4 · solana devnet
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-[13px] text-muted-foreground">
          <Link to="/auctions" className="hover:text-foreground transition-colors">
            Auctions
          </Link>
          <Link to="/get-csol" className="hover:text-foreground transition-colors">
            Get cSOL
          </Link>
          <Link to="/create-auction" className="hover:text-foreground transition-colors">
            Create
          </Link>
          <Link to="/profile" className="hover:text-foreground transition-colors">
            Profile
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald pulse-dot" />
            <span className="tabular">DEVNET RPC</span>
          </div>
          <WalletButton />
          <button
            aria-label="Menu"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded-md border border-hairline bg-surface-elevated"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="none"
              strokeWidth="1.5"
            >
              {mobileOpen ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden hairline-t bg-background/95 backdrop-blur-xl">
          <nav className="px-6 py-4 flex flex-col gap-1 text-[14px]">
            {[
              { l: "Auctions", to: "/auctions" as const },
              { l: "Get cSOL", to: "/get-csol" as const },
              { l: "Create", to: "/create-auction" as const },
              { l: "Profile", to: "/profile" as const },
            ].map((i) => (
              <Link
                key={i.l}
                to={i.to}
                onClick={() => setMobileOpen(false)}
                className="py-2.5 text-muted-foreground hover:text-foreground hairline-b"
              >
                {i.l}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
