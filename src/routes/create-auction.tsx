import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Nav } from "@/components/obscura/Nav";
import { Footer } from "@/components/obscura/Footer";
import { useMarket, type MarketAuction } from "@/components/obscura/MarketContext";
import { useWallet } from "@/components/obscura/WalletContext";
import { mintDevnetDemoLot, type TokenMintReceipt } from "@/lib/devnetTokens";
import art from "@/assets/lot-art.jpg";
import tokens from "@/assets/lot-tokens.jpg";
import watch from "@/assets/lot-watch.jpg";
import wine from "@/assets/lot-wine.jpg";

export const Route = createFileRoute("/create-auction")({
  component: CreateAuctionPage,
});

function CreateAuctionPage() {
  const wallet = useWallet();
  const market = useMarket();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"new" | "owned">("new");
  const [lotId, setLotId] = useState(market.ownedLots[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadedImage, setUploadedImage] = useState("");
  const [reserve, setReserve] = useState("1");
  const [closesAt, setClosesAt] = useState(defaultCloseTime());
  const [type, setType] = useState<MarketAuction["type"]>("Sealed-Bid");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdAuction, setCreatedAuction] = useState<MarketAuction | null>(null);

  const fallbackImage = useMemo(() => {
    const images = [art, tokens, watch, wine];
    return images[Math.abs(title.length + description.length) % images.length];
  }, [description.length, title.length]);
  const finalImage = uploadedImage || imageUrl.trim() || fallbackImage;

  async function submit() {
    if (!wallet.address) {
      setError("Connect a devnet wallet before creating an auction.");
      return;
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (mode === "new" && cleanTitle.length < 3) {
      setError("Enter an item name with at least 3 characters.");
      return;
    }
    if (mode === "owned" && !lotId) {
      setError("Select an owned lot or switch to creating a new lot.");
      return;
    }

    const parsedReserve = parseFloat(reserve);
    const closeTime = new Date(closesAt);
    if (!Number.isFinite(parsedReserve) || parsedReserve <= 0) {
      setError("Enter a positive reserve price.");
      return;
    }
    if (Number.isNaN(closeTime.getTime())) {
      setError("Choose a valid close time.");
      return;
    }
    if (closeTime.getTime() - Date.now() < 5 * 60_000) {
      setError("Close time must be at least 5 minutes from now.");
      return;
    }

    setError(null);
    setCreating(true);
    try {
      let lotReceipt: TokenMintReceipt | undefined;
      if (mode === "new") {
        lotReceipt = await mintDevnetDemoLot({
          owner: wallet.address,
          signAndSendTransaction: wallet.signAndSendTransaction,
        });
        await wallet.refreshBalance();
      }

      const auction = await market.createAuction({
        lotId: mode === "owned" ? lotId : undefined,
        lot:
          mode === "new"
            ? {
                title: cleanTitle,
                description: cleanDescription || undefined,
                image: finalImage,
                collection: "Obscura Creator Lot",
                mint: lotReceipt?.mint,
                tokenAccount: lotReceipt?.tokenAccount,
                mintSignature: lotReceipt?.signature,
              }
            : undefined,
        reserve: parsedReserve,
        closesAt: closeTime.toISOString(),
        type,
        owner: wallet.address,
      });
      setCreatedAuction(auction);
      await navigate({ to: "/auctions" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mint the lot and create auction.");
    } finally {
      setCreating(false);
    }
  }

  function uploadImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the lot.");
      return;
    }
    if (file.size > 900_000) {
      setError("Use an image under 900 KB for this local devnet demo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(String(reader.result));
      setError(null);
    };
    reader.onerror = () => setError("Unable to read that image file.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="mx-auto max-w-[1100px] px-6 lg:px-10 pt-16">
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-tertiary">
          Create - blind auction
        </div>
        <h1 className="mt-3 font-display text-[52px] leading-[0.95] tracking-[-0.02em]">
          Create the lot and auction together.
        </h1>
        <p className="mt-5 max-w-xl text-muted-foreground">
          Add the item name, image, reserve, auction type, and close time in one flow. Bidders use
          cSOL, which wraps devnet SOL 1:1, while bid values stay private until settlement.
        </p>

        {createdAuction ? (
          <SuccessPanel auction={createdAuction} onCreateAnother={() => setCreatedAuction(null)} />
        ) : (
          <div className="mt-10 rounded-lg border border-hairline bg-surface p-6">
            <div className="mb-6 inline-grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline">
              {[
                ["new", "New lot"],
                ["owned", "Owned lot"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setMode(value as "new" | "owned")}
                  className={`h-9 px-4 text-[12px] font-mono uppercase tracking-[0.16em] ${
                    mode === value
                      ? "bg-emerald text-background"
                      : "bg-surface text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "new" ? (
              <div className="grid lg:grid-cols-[1fr_300px] gap-6">
                <div className="grid md:grid-cols-2 gap-5">
                  <label className="md:col-span-2">
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
                      Item name
                    </span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Signed genesis print"
                      className="mt-2 h-12 w-full rounded-md border border-hairline bg-background px-4 text-[14px] outline-none focus:border-emerald/60"
                    />
                  </label>
                  <label className="md:col-span-2">
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
                      Description
                    </span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What bidders need to know before placing a sealed bid."
                      className="mt-2 min-h-24 w-full rounded-md border border-hairline bg-background px-4 py-3 text-[14px] outline-none focus:border-emerald/60"
                    />
                  </label>
                  <label>
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
                      Image URL
                    </span>
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="mt-2 h-12 w-full rounded-md border border-hairline bg-background px-4 text-[14px] outline-none focus:border-emerald/60"
                    />
                  </label>
                  <label>
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
                      Upload image
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadImage(e.target.files?.[0])}
                      className="mt-2 block w-full text-[13px] text-muted-foreground file:mr-3 file:h-10 file:rounded-md file:border-0 file:bg-background file:px-3 file:text-[12px] file:text-foreground"
                    />
                  </label>
                </div>
                <div className="rounded-lg border border-hairline bg-background overflow-hidden">
                  <img
                    src={finalImage}
                    alt={title || "Lot preview"}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="p-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
                      Lot preview
                    </div>
                    <div className="mt-1 font-display text-[20px] leading-tight">
                      {title || "Untitled auction lot"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <label className="block">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
                  Owned lot
                </span>
                <select
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                  className="mt-2 h-12 w-full rounded-md border border-hairline bg-background px-3 text-[14px]"
                >
                  {market.ownedLots.length === 0 && <option value="">No owned lots yet</option>}
                  {market.ownedLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="mt-6 grid md:grid-cols-3 gap-5">
              <label>
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
                  Format
                </span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as MarketAuction["type"])}
                  className="mt-2 h-12 w-full rounded-md border border-hairline bg-background px-3 text-[14px]"
                >
                  <option>Sealed-Bid</option>
                  <option>Vickrey</option>
                  <option>Uniform Price</option>
                </select>
              </label>
              <label>
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
                  Reserve cSOL
                </span>
                <input
                  value={reserve}
                  onChange={(e) => setReserve(e.target.value.replace(/[^\d.]/g, ""))}
                  className="mt-2 h-12 w-full rounded-md border border-hairline bg-background px-4 font-mono"
                />
              </label>
              <label>
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
                  Close time
                </span>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="mt-2 h-12 w-full rounded-md border border-hairline bg-background px-4 font-mono"
                />
              </label>
            </div>

            <AuctionTypeExplanation type={type} />

            {error && <div className="mt-5 text-sm text-destructive">{error}</div>}

            <div className="mt-6 grid md:grid-cols-3 gap-px bg-hairline border border-hairline">
              <Explainer label="Public lot data" value="Name, image, description, cSOL reserve" />
              <Explainer label="Hidden before close" value="Bid amounts and losing strategy" />
              <Explainer label="Arcium role" value="MPC comparison over encrypted bids" />
            </div>

            <button
              onClick={submit}
              disabled={
                !wallet.connected || creating || (mode === "owned" && market.ownedLots.length === 0)
              }
              className="mt-6 h-11 px-5 rounded-md bg-emerald text-background text-[14px] font-medium disabled:opacity-50"
            >
              {creating
                ? mode === "new"
                  ? "Minting lot and creating..."
                  : "Creating..."
                : "Create blind auction"}
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function defaultCloseTime() {
  const next = new Date(Date.now() + 15 * 60 * 1000);
  next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5, 0, 0);
  return toLocalInputValue(next);
}

function toLocalInputValue(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function AuctionTypeExplanation({ type }: { type: MarketAuction["type"] }) {
  const copy =
    type === "Vickrey"
      ? "Highest private bid wins, but the winner pays the second-highest private bid. This rewards truthful bidding."
      : type === "Uniform Price"
        ? "Multiple winners clear at one computed price. Arcium keeps the demand curve private until settlement."
        : "Highest private bid wins and pays their own bid. No public bid ladder exists before close.";

  return (
    <div className="mt-5 rounded-md border border-hairline bg-background/60 p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
        Auction type
      </div>
      <div className="mt-1 text-[13px] text-muted-foreground">{copy}</div>
    </div>
  );
}

function SuccessPanel({
  auction,
  onCreateAnother,
}: {
  auction: MarketAuction;
  onCreateAnother: () => void;
}) {
  const path = `/auctions/${auction.id}`;
  const shareUrl = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-10 rounded-lg border border-emerald/30 bg-surface p-6">
      <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-emerald">
        Auction created
      </div>
      <h2 className="mt-3 font-display text-[34px] leading-tight">{auction.title}</h2>
      <p className="mt-3 max-w-xl text-muted-foreground">
        The lot is now listed as a blind auction. Share this link with bidders; their bid amounts
        stay hidden until settlement.
      </p>

      {auction.mint && (
        <div className="mt-5 rounded-md border border-hairline bg-background p-3 font-mono text-[11px] text-muted-foreground">
          <div className="text-emerald">devnet lot minted</div>
          <div className="mt-1 break-all">mint {auction.mint}</div>
          {auction.tokenAccount && <div className="mt-1 break-all">ata {auction.tokenAccount}</div>}
        </div>
      )}

      <div className="mt-5 rounded-md border border-hairline bg-background p-3 font-mono text-[12px] break-all">
        {shareUrl}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={copyLink}
          className="h-10 px-4 rounded-md bg-emerald text-background text-[13px] font-medium"
        >
          {copied ? "Copied" : "Share auction link"}
        </button>
        <Link
          to="/auctions/$id"
          params={{ id: auction.id }}
          className="h-10 px-4 inline-flex items-center rounded-md border border-hairline text-[13px]"
        >
          View auction
        </Link>
        <button
          onClick={onCreateAnother}
          className="h-10 px-4 rounded-md border border-hairline text-[13px]"
        >
          Create another
        </button>
      </div>
    </div>
  );
}

function Explainer({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">{label}</div>
      <div className="mt-1 text-[13px] text-muted-foreground">{value}</div>
    </div>
  );
}
