import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Transaction } from "@solana/web3.js";
import { DEVNET_RPC } from "@/lib/solanaRpc";

const LAMPORTS_PER_SOL = 1_000_000_000;

type SolanaProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toString: () => string } | null;
  connect: (opts?: {
    onlyIfTrusted?: boolean;
  }) => Promise<{ publicKey: { toString: () => string } }>;
  signAndSendTransaction?: (transaction: Transaction) => Promise<{ signature: string } | string>;
  disconnect?: () => Promise<void>;
  on?: (event: "accountChanged" | "disconnect", handler: (...args: unknown[]) => void) => void;
  off?: (event: "accountChanged" | "disconnect", handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
    solflare?: SolanaProvider;
  }
}

type WalletState = {
  connected: boolean;
  address: string | null;
  balance: number;
  connecting: boolean;
  airdropping: boolean;
  providerName: string | null;
  error: string | null;
  endpoint: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  requestAirdrop: () => Promise<void>;
  signAndSendTransaction: (transaction: Transaction) => Promise<string>;
};

const Ctx = createContext<WalletState | null>(null);

function getProvider() {
  if (typeof window === "undefined") return null;
  return window.phantom?.solana ?? window.solana ?? window.solflare ?? null;
}

function getProviderName(provider: SolanaProvider | null) {
  if (!provider) return null;
  if (provider.isPhantom) return "Phantom";
  if (provider.isSolflare) return "Solflare";
  return "Injected wallet";
}

async function fetchDevnetBalance(address: string) {
  const res = await fetch(DEVNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "obscura-balance",
      method: "getBalance",
      params: [address, { commitment: "confirmed" }],
    }),
  });
  if (!res.ok) throw new Error("Unable to reach Solana devnet.");
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "Unable to read devnet balance.");
  return json.result.value / LAMPORTS_PER_SOL;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [airdropping, setAirdropping] = useState(false);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function hydrate(publicKey: { toString: () => string }, provider: SolanaProvider | null) {
    const nextAddress = publicKey.toString();
    setAddress(nextAddress);
    setProviderName(getProviderName(provider));
    setBalance(await fetchDevnetBalance(nextAddress));
  }

  useEffect(() => {
    const provider = getProvider();
    setProviderName(getProviderName(provider));
    if (!provider) return;

    provider
      .connect({ onlyIfTrusted: true })
      .then(({ publicKey }) => hydrate(publicKey, provider))
      .catch(() => {
        // Silent auto-connect failures are expected until the user approves a wallet.
      });

    const onAccountChanged = (nextKey: unknown) => {
      if (!nextKey || typeof nextKey !== "object" || !("toString" in nextKey)) {
        setAddress(null);
        setBalance(0);
        return;
      }
      hydrate(nextKey as { toString: () => string }, provider).catch((err: Error) =>
        setError(err.message),
      );
    };
    const onDisconnect = () => {
      setAddress(null);
      setBalance(0);
    };

    provider.on?.("accountChanged", onAccountChanged);
    provider.on?.("disconnect", onDisconnect);
    return () => {
      provider.off?.("accountChanged", onAccountChanged);
      provider.off?.("disconnect", onDisconnect);
    };
  }, []);

  async function connect() {
    const provider = getProvider();
    setError(null);
    if (!provider) {
      setError("Install Phantom or Solflare, then switch it to devnet.");
      return;
    }

    setConnecting(true);
    try {
      const { publicKey } = await provider.connect();
      await hydrate(publicKey, provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection was rejected.");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    const provider = getProvider();
    await provider?.disconnect?.();
    setAddress(null);
    setBalance(0);
    setError(null);
  }

  async function refreshBalance() {
    if (!address) return;
    setError(null);
    try {
      setBalance(await fetchDevnetBalance(address));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh devnet balance.");
    }
  }

  async function requestAirdrop() {
    if (!address) return;
    setError(null);
    setAirdropping(true);
    try {
      const res = await fetch(DEVNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "obscura-airdrop",
          method: "requestAirdrop",
          params: [address, LAMPORTS_PER_SOL],
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Devnet airdrop failed.");
      }
      await new Promise((r) => setTimeout(r, 1400));
      setBalance(await fetchDevnetBalance(address));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Devnet airdrop failed.");
    } finally {
      setAirdropping(false);
    }
  }

  async function signAndSendTransaction(transaction: Transaction) {
    const provider = getProvider();
    if (!provider?.signAndSendTransaction) {
      throw new Error("Connected wallet cannot sign transactions from this browser.");
    }
    const result = await provider.signAndSendTransaction(transaction);
    return typeof result === "string" ? result : result.signature;
  }

  return (
    <Ctx.Provider
      value={{
        connected: Boolean(address),
        address,
        balance,
        connecting,
        airdropping,
        providerName,
        error,
        endpoint: DEVNET_RPC,
        connect,
        disconnect,
        refreshBalance,
        requestAirdrop,
        signAndSendTransaction,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}

export function shortAddr(a: string | null) {
  if (!a) return "";
  return `${a.slice(0, 4)}..${a.slice(-4)}`;
}
