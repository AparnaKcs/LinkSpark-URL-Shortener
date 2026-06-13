import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snip — URL Shortener with Analytics" },
      {
        name: "description",
        content:
          "Production-grade link infrastructure. Shorten URLs, generate QR codes, and track every click in real time.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <nav className="border-b border-border bg-card/45 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="text-sm font-semibold px-3 py-1.5 text-foreground hover:text-primary hover:bg-muted/10 rounded-md transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" } as never}
              className="text-sm font-semibold px-4 py-1.5 bg-brand text-brand-foreground rounded-md hover:brightness-110 transition font-bold"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6">
        {/* Hero */}
        <section className="py-24 md:py-32 max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-balance text-foreground leading-tight">
            Smarter links, <br />
            <span className="bg-gradient-to-r from-brand via-[#A28089] to-primary bg-clip-text text-transparent">
              deeper insights.
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl text-pretty leading-relaxed font-semibold">
            Create short, custom links in seconds and track performance in real time. Simple, fast,
            and powerful.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" } as never}
              className="bg-brand text-brand-foreground px-5 py-2.5 rounded-md text-sm font-semibold shadow-md hover:shadow-lg hover:brightness-110 transition duration-300 font-bold"
            >
              Create your first link →
            </Link>
            <Link
              to="/auth"
              className="border border-border bg-card px-5 py-2.5 rounded-md text-sm font-semibold text-foreground hover:bg-muted/15 transition duration-300"
            >
              Sign in
            </Link>
          </div>
        </section>

        {/* Feature grid */}
        <section className="py-16 grid md:grid-cols-3 gap-4 border-t border-border">
          {[
            {
              k: "01",
              t: "Server-side redirects",
              d: "302 redirects served from the edge with per-click analytics capture — no client JavaScript required.",
            },
            {
              k: "02",
              t: "Real-time analytics",
              d: "Click counts, browser, device, OS, country, and 30-day daily trends with first-class chart rendering.",
            },
            {
              k: "03",
              t: "QR + custom aliases",
              d: "Generate downloadable QR codes for any link. Reserve memorable aliases like /launch.",
            },
            {
              k: "04",
              t: "Optional expiry",
              d: "Time-bomb links for campaigns. Expired links return a clean 410 page instead of stale destinations.",
            },
            {
              k: "05",
              t: "Public stats endpoint",
              d: "Share /stats/:code without revealing the destination. Aggregate metrics only.",
            },
            {
              k: "06",
              t: "Bulk CSV import",
              d: "Shorten hundreds of URLs at once. Paste a list and get a downloadable manifest back.",
            },
          ].map((f) => (
            <div
              key={f.k}
              className="bg-card backdrop-blur-md p-6 rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition duration-300"
            >
              <div className="font-mono text-[11px] font-bold text-primary mb-3">{f.k}</div>
              <div className="font-bold text-foreground mb-1.5">{f.t}</div>
              <div className="text-sm text-muted-foreground leading-relaxed font-medium">{f.d}</div>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-10 mt-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-1.5 opacity-80 text-brand">
            <span className="text-xs font-semibold tracking-tight text-foreground">Snip</span>
          </div>
          <p className="text-xs text-muted-foreground font-semibold">
            This project is a part of a hackathon run by{" "}
            <a className="underline hover:text-primary" href="https://katomaran.com">
              katomaran.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
