import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vektor — URL Shortener with Analytics" },
      { name: "description", content: "Production-grade link infrastructure. Shorten URLs, generate QR codes, and track every click in real time." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-6 bg-brand rounded-sm flex items-center justify-center">
              <div className="size-2 bg-background rotate-45" />
            </div>
            <span className="font-semibold tracking-tight">VEKTOR</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="text-sm font-medium px-3 py-1.5 hover:bg-muted rounded-md transition-colors">Sign in</Link>
            <Link to="/auth" search={{ mode: "signup" } as never} className="text-sm font-medium px-4 py-1.5 bg-foreground text-background rounded-md hover:opacity-90 transition">Get started</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6">
        {/* Hero */}
        <section className="py-24 md:py-32 max-w-3xl">
          <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-6">
            <div className="size-1.5 bg-brand rounded-full animate-pulse" />
            System operational
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-balance">
            Link infrastructure built for <span className="text-brand">operators</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl text-pretty">
            Shorten URLs, route traffic, and track every click with millisecond precision.
            Custom aliases, QR codes, expiry, and a public stats endpoint — out of the box.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/auth" search={{ mode: "signup" } as never} className="bg-brand text-brand-foreground px-5 py-2.5 rounded-md text-sm font-medium shadow-sm hover:brightness-110 transition">
              Create your first link →
            </Link>
            <Link to="/auth" className="border border-border px-5 py-2.5 rounded-md text-sm font-medium hover:bg-muted transition">
              Sign in
            </Link>
          </div>
        </section>

        {/* Feature grid */}
        <section className="py-16 grid md:grid-cols-3 gap-4 border-t border-border">
          {[
            { k: "01", t: "Server-side redirects", d: "302 redirects served from the edge with per-click analytics capture — no client JavaScript required." },
            { k: "02", t: "Real-time analytics", d: "Click counts, browser, device, OS, country, and 30-day daily trends with first-class chart rendering." },
            { k: "03", t: "QR + custom aliases", d: "Generate downloadable QR codes for any link. Reserve memorable aliases like /launch." },
            { k: "04", t: "Optional expiry", d: "Time-bomb links for campaigns. Expired links return a clean 410 page instead of stale destinations." },
            { k: "05", t: "Public stats endpoint", d: "Share /stats/:code without revealing the destination. Aggregate metrics only." },
            { k: "06", t: "Bulk CSV import", d: "Shorten hundreds of URLs at once. Paste a list and get a downloadable manifest back." },
          ].map((f) => (
            <div key={f.k} className="bg-surface p-6 rounded-xl ring-1 ring-border">
              <div className="font-mono text-[11px] text-muted-foreground mb-3">{f.k}</div>
              <div className="font-medium mb-1.5">{f.t}</div>
              <div className="text-sm text-muted-foreground">{f.d}</div>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-10 mt-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2 opacity-60">
            <div className="size-4 bg-foreground rounded-sm" />
            <span className="text-xs font-semibold tracking-tight">VEKTOR</span>
          </div>
          <p className="text-xs text-muted-foreground">
            This project is a part of a hackathon run by{" "}
            <a className="underline hover:text-foreground" href="https://katomaran.com">katomaran.com</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
