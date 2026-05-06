export function Footer() {
  return (
    <footer className="hairline-t mt-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-14 grid grid-cols-2 md:grid-cols-5 gap-10 text-[13px]">
        <div className="col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="relative inline-flex h-5 w-5 items-center justify-center">
              <span className="absolute inset-0 rounded-sm border border-emerald/60" />
              <span className="absolute inset-1 bg-emerald/80" />
            </span>
            <span className="font-display text-[17px]">Obscura</span>
          </div>
          <p className="mt-4 text-muted-foreground max-w-sm leading-relaxed">
            Confidential price discovery for digital assets. Encrypted bidding powered by Arcium MPC
            on Solana.
          </p>
          <p className="mt-6 text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary">
            Copyright 2026 Obscura Labs
          </p>
        </div>
        {[
          { h: "Protocol", l: ["Auctions", "Markets", "Validators", "Audits"] },
          { h: "Developers", l: ["Documentation", "SDK", "API", "Bug Bounty"] },
          { h: "Company", l: ["About", "Careers", "Press", "Disclosures"] },
        ].map((c) => (
          <div key={c.h}>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-tertiary mb-4">
              {c.h}
            </div>
            <ul className="space-y-2.5 text-muted-foreground">
              {c.l.map((i) => (
                <li key={i}>
                  <a className="hover:text-foreground transition-colors" href="#">
                    {i}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
