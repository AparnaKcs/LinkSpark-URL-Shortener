import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppNav } from "@/components/app-nav";
import { QrDialog } from "@/components/qr-dialog";
import { listUrls, createUrl, deleteUrl, bulkShorten } from "@/lib/urls.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Vektor" }] }),
  component: Dashboard,
});

function shortUrl(code: string) {
  if (typeof window === "undefined") return `/r/${code}`;
  return `${window.location.origin}/r/${code}`;
}

function Dashboard() {
  const list = useServerFn(listUrls);
  const create = useServerFn(createUrl);
  const del = useServerFn(deleteUrl);
  const bulk = useServerFn(bulkShorten);
  const qc = useQueryClient();
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  useMemo(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const { data: urls = [], isLoading } = useQuery({
    queryKey: ["urls"],
    queryFn: () => list(),
  });

  const [longUrl, setLongUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiry, setExpiry] = useState("");
  const [search, setSearch] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const createMut = useMutation({
    mutationFn: create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["urls"] });
      setLongUrl(""); setAlias(""); setExpiry("");
      toast.success("Link created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: del,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["urls"] });
      toast.success("Link deleted");
    },
  });

  const bulkMut = useMutation({
    mutationFn: bulk,
    onSuccess: (rows) => {
      qc.invalidateQueries({ queryKey: ["urls"] });
      setShowBulk(false); setBulkText("");
      toast.success(`Created ${rows.length} links`);
      const csv = "original_url,short_url\n" + rows.map((r) => `${r.original_url},${shortUrl(r.short_code)}`).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = "shortened.csv"; link.click();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const parsed = z.object({
        original_url: z.string().trim().url("Invalid URL"),
        custom_alias: z.string().regex(/^[a-zA-Z0-9_-]{3,32}$/).optional(),
      }).parse({
        original_url: longUrl,
        custom_alias: alias || undefined,
      });
      createMut.mutate({
        data: {
          original_url: parsed.original_url,
          custom_alias: parsed.custom_alias ?? null,
          expiry_date: expiry ? new Date(expiry).toISOString() : null,
        },
      });
    } catch (err) {
      toast.error(err instanceof z.ZodError ? err.issues[0].message : (err as Error).message);
    }
  }

  function submitBulk() {
    const lines = bulkText.split(/\r?\n/).map((l) => l.split(",")[0].trim()).filter(Boolean);
    if (!lines.length) return toast.error("Paste at least one URL");
    bulkMut.mutate({ data: { urls: lines } });
  }

  const filtered = urls.filter((u) =>
    !search ||
    u.original_url.toLowerCase().includes(search.toLowerCase()) ||
    u.short_code.toLowerCase().includes(search.toLowerCase()),
  );

  const totalClicks = urls.reduce((s, u) => s + (u.click_count ?? 0), 0);
  const activeLinks = urls.filter((u) => !u.expiry_date || new Date(u.expiry_date) > new Date()).length;
  const expired = urls.length - activeLinks;
  const last = urls.find((u) => u.last_visited_at)?.last_visited_at;

  return (
    <div className="min-h-screen bg-background">
      <AppNav email={email} />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Network Performance</h1>
            <p className="text-sm text-muted-foreground">Real-time traffic across your shortened infrastructure.</p>
          </div>
          <button onClick={() => setShowBulk(true)} className="text-sm font-medium border border-border px-4 py-2 rounded-md hover:bg-muted transition">
            Bulk import CSV
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat label="Total Clicks" value={totalClicks.toLocaleString()} tag="all-time" />
          <Stat label="Active Links" value={String(activeLinks)} tag="healthy" pulse />
          <Stat label="Expired" value={String(expired)} tag="archived" />
          <Stat label="Last Visit" value={last ? new Date(last).toLocaleString() : "—"} tag="" />
        </div>

        {/* Create form */}
        <form onSubmit={submitCreate} className="bg-surface ring-1 ring-border rounded-xl p-4 mb-8 grid md:grid-cols-[1fr_180px_180px_auto] gap-3">
          <input value={longUrl} onChange={(e) => setLongUrl(e.target.value)} placeholder="https://very-long-url.com/article" required className="h-10 px-3 bg-background border border-input rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/40" />
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="custom-alias (optional)" className="h-10 px-3 bg-background border border-input rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/40" />
          <input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-10 px-3 bg-background border border-input rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/40" />
          <button disabled={createMut.isPending} className="h-10 px-5 bg-brand text-brand-foreground rounded-md text-sm font-medium hover:brightness-110 transition disabled:opacity-50">
            {createMut.isPending ? "…" : "Shorten"}
          </button>
        </form>

        {/* Search */}
        <div className="mb-4 flex items-center justify-between">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search links…" className="h-9 px-3 bg-surface border border-input rounded-md text-sm w-72 focus:outline-none focus:ring-2 focus:ring-brand/40" />
          <span className="text-xs text-muted-foreground font-mono">{filtered.length} link{filtered.length === 1 ? "" : "s"}</span>
        </div>

        {/* Table */}
        <div className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium">No links yet</p>
              <p className="text-xs text-muted-foreground mt-1">Paste a URL above to create your first short link.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  {["Destination", "Short Code", "Clicks", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-medium uppercase text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => {
                  const isExpired = u.expiry_date && new Date(u.expiry_date) < new Date();
                  const expiringSoon = u.expiry_date && !isExpired && new Date(u.expiry_date).getTime() - Date.now() < 7 * 86400000;
                  return (
                    <tr key={u.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <a href={u.original_url} target="_blank" rel="noreferrer" className="text-sm font-medium truncate block max-w-[280px] hover:text-brand">
                          {u.original_url}
                        </a>
                        <p className="text-[11px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs bg-muted px-1.5 py-1 rounded">/r/{u.short_code}</code>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">{u.click_count.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                          isExpired ? "bg-destructive/10 text-destructive" :
                          expiringSoon ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                          "bg-brand/10 text-brand"
                        }`}>
                          {isExpired ? "Expired" : expiringSoon ? "Expiring" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs">
                          <button onClick={() => { navigator.clipboard.writeText(shortUrl(u.short_code)); toast.success("Copied"); }} className="text-muted-foreground hover:text-foreground">Copy</button>
                          <Link to="/analytics/$id" params={{ id: u.id }} className="text-muted-foreground hover:text-foreground">Stats</Link>
                          <button onClick={() => setQrCode(shortUrl(u.short_code))} className="text-muted-foreground hover:text-foreground">QR</button>
                          <button onClick={() => confirm("Delete this link?") && delMut.mutate({ data: { id: u.id } })} className="text-destructive hover:opacity-80">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {qrCode && <QrDialog url={qrCode} onClose={() => setQrCode(null)} />}

      {showBulk && (
        <div className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm grid place-items-center p-4" onClick={() => setShowBulk(false)}>
          <div className="bg-surface rounded-xl ring-1 ring-border p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">Bulk shorten</h3>
            <p className="text-xs text-muted-foreground mb-3">One URL per line. Up to 200. We'll auto-download a CSV with the short links.</p>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={8} className="w-full p-3 bg-background border border-input rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/40" placeholder="https://example.com/a&#10;https://example.com/b" />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowBulk(false)} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted">Cancel</button>
              <button onClick={submitBulk} disabled={bulkMut.isPending} className="px-4 py-2 text-sm bg-brand text-brand-foreground rounded-md hover:brightness-110 disabled:opacity-50">
                {bulkMut.isPending ? "Working…" : "Shorten all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tag, pulse }: { label: string; value: string; tag: string; pulse?: boolean }) {
  return (
    <div className="bg-surface p-4 rounded-xl ring-1 ring-border">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-mono font-medium">{value}</p>
      <div className="mt-2 flex items-center gap-1.5">
        {pulse && <div className="size-2 bg-brand rounded-full animate-pulse" />}
        <span className="text-[10px] font-medium text-muted-foreground">{tag}</span>
      </div>
    </div>
  );
}
