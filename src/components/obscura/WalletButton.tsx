import { useState } from "react";
import { useWallet, shortAddr } from "./WalletContext";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const {
    connected,
    address,
    balance,
    connecting,
    airdropping,
    providerName,
    error,
    connect,
    disconnect,
    refreshBalance,
    requestAirdrop,
  } = useWallet();
  const [open, setOpen] = useState(false);

  if (!connected) {
    return (
      <div className="relative">
        <button
          onClick={connect}
          disabled={connecting}
          className="group relative h-8 px-3.5 rounded-md border border-hairline bg-surface-elevated text-[12px] font-medium hover:border-emerald/50 transition-colors disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            {connecting ? (
              <>
                <Spinner /> Connecting...
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                {compact ? "Connect" : "Connect Wallet"}
              </>
            )}
          </span>
        </button>
        {error && (
          <div
            className="absolute right-0 top-10 z-50 w-72 rounded-lg border border-destructive/40 bg-popover p-3 text-[12px] text-muted-foreground"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            <div className="font-medium text-foreground">Wallet not connected</div>
            <div className="mt-1">{error}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-8 pl-2 pr-3 rounded-md border border-hairline bg-surface-elevated text-[12px] font-mono flex items-center gap-2 hover:border-foreground/30 transition-colors"
      >
        <span className="h-5 w-5 rounded-sm bg-gradient-to-br from-emerald to-electric/70" />
        <span className="tabular hidden sm:inline">SOL {balance.toFixed(4)}</span>
        <span className="text-muted-foreground">{shortAddr(address)}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-10 z-50 w-72 rounded-lg border border-hairline bg-popover p-4 animate-in fade-in slide-in-from-top-1"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tertiary">
              {providerName ?? "Wallet"}
            </div>
            <div className="mt-2 font-mono text-[13px] truncate">{address}</div>
            <div className="mt-4 hairline-t pt-3 flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
                Devnet balance
              </span>
              <span className="font-mono tabular text-[15px]">SOL {balance.toFixed(4)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span>Solana Devnet</span>
              <span className="text-emerald">Wallet ready</span>
            </div>
            {error && <div className="mt-3 text-[11px] text-destructive">{error}</div>}
            <button
              onClick={requestAirdrop}
              disabled={airdropping}
              className="mt-4 w-full h-9 rounded-md border border-emerald/40 bg-emerald/10 text-[12px] text-emerald hover:border-emerald/70 transition-colors disabled:opacity-60"
            >
              {airdropping ? "Requesting..." : "Request 1 devnet SOL"}
            </button>
            <button
              onClick={refreshBalance}
              className="mt-2 w-full h-9 rounded-md border border-hairline text-[12px] hover:border-emerald/50 transition-colors"
            >
              Refresh balance
            </button>
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="mt-2 w-full h-9 rounded-md border border-hairline text-[12px] hover:border-destructive/60 hover:text-destructive transition-colors"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
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
