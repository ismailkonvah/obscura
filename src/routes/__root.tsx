import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { WalletProvider, useWallet } from "@/components/obscura/WalletContext";
import { MarketProvider, useMarket } from "@/components/obscura/MarketContext";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
          404 · Lot not found
        </div>
        <h1 className="mt-3 font-display text-5xl">Sealed and gone.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The auction you're looking for has settled or never existed.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-hairline bg-surface-elevated px-4 py-2 text-sm hover:border-emerald/50 transition-colors"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Obscura — Confidential Auctions on Solana" },
      {
        name: "description",
        content:
          "Encrypted sealed-bid auctions powered by Arcium MPC on Solana. Private bidding, fair price discovery, institutional-grade settlement.",
      },
      { name: "author", content: "Obscura Labs" },
      { property: "og:title", content: "Obscura — Confidential Auctions on Solana" },
      {
        property: "og:description",
        content: "Encrypted sealed-bid auctions powered by Arcium MPC on Solana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: () => (
    <WalletProvider>
      <MarketProvider>
        <CsolBalanceSync />
        <Outlet />
      </MarketProvider>
    </WalletProvider>
  ),
  notFoundComponent: NotFoundComponent,
});

function CsolBalanceSync() {
  const wallet = useWallet();
  const market = useMarket();

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      if (!wallet.address) {
        market.setConfidentialBalance(0);
        return;
      }
      try {
        const { getDevnetCsolBalance } = await import("@/lib/devnetTokens");
        const snapshot = await getDevnetCsolBalance(wallet.address);
        if (!cancelled) market.setConfidentialBalance(snapshot.balance);
      } catch {
        if (!cancelled) market.setConfidentialBalance(0);
      }
    }
    sync();
    return () => {
      cancelled = true;
    };
    // The market context object changes whenever market state changes; syncing only needs wallet changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.address]);

  return null;
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
