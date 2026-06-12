import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppNav } from "@/components/app-nav";
import { QrDialog } from "@/components/qr-dialog";
import { listUrls, createUrl, deleteUrl, bulkShorten, updateUrl } from "@/lib/urls.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Pencil,
  Trash2,
  BarChart3,
  QrCode,
  Plus,
  Upload,
  Search,
  Copy,
  ExternalLink,
  X,
  ChevronDown
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Snip" }] }),
  component: Dashboard,
});

function shortUrl(code: string) {
  if (typeof window === "undefined") return `/r/${code}`;
  return `${window.location.origin}/r/${code}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function Dashboard() {
  const list = useServerFn(listUrls);
  const create = useServerFn(createUrl);
  const del = useServerFn(deleteUrl);
  const bulk = useServerFn(bulkShorten);
  const update = useServerFn(updateUrl);
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

  // Modals state
  const [showCreate, setShowCreate] = useState(false);
  const [editLink, setEditLink] = useState<any | null>(null);
  const [showBulk, setShowBulk] = useState(false);

  // Form fields
  const [longUrl, setLongUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiryType, setExpiryType] = useState<"never" | "custom">("never");
  const [expiry, setExpiry] = useState("");

  const [editOriginalUrl, setEditOriginalUrl] = useState("");
  const [editExpiry, setEditExpiry] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");

  const createMut = useMutation({
    mutationFn: create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["urls"] });
      setLongUrl("");
      setAlias("");
      setExpiry("");
      setExpiryType("never");
      setShowCreate(false);
      toast.success("Link created successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["urls"] });
      setEditLink(null);
      setEditOriginalUrl("");
      setEditExpiry("");
      toast.success("Link updated successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: del,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["urls"] });
      toast.success("Link deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: bulk,
    onSuccess: (rows) => {
      qc.invalidateQueries({ queryKey: ["urls"] });
      setShowBulk(false);
      setBulkText("");
      toast.success(`Created ${rows.length} links`);
      const csv =
        "original_url,short_url\n" +
        rows.map((r) => `${r.original_url},${shortUrl(r.short_code)}`).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "shortened.csv";
      link.click();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const parsed = z
        .object({
          original_url: z.string().trim().url("Invalid URL"),
          custom_alias: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{3,32}$/, "Alias must be 3-32 alphanumeric characters, dashes, or underscores")
            .optional()
            .nullable(),
        })
        .parse({
          original_url: longUrl,
          custom_alias: alias || undefined,
        });

      createMut.mutate({
        data: {
          original_url: parsed.original_url,
          custom_alias: parsed.custom_alias ?? null,
          expiry_date: expiryType === "custom" && expiry ? new Date(expiry).toISOString() : null,
        },
      });
    } catch (err) {
      toast.error(err instanceof z.ZodError ? err.issues[0].message : (err as Error).message);
    }
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editLink) return;
    try {
      const parsed = z
        .object({
          original_url: z.string().trim().url("Invalid URL"),
        })
        .parse({
          original_url: editOriginalUrl,
        });

      updateMut.mutate({
        data: {
          id: editLink.id,
          original_url: parsed.original_url,
          expiry_date: editExpiry ? new Date(editExpiry).toISOString() : null,
        },
      });
    } catch (err) {
      toast.error(err instanceof z.ZodError ? err.issues[0].message : (err as Error).message);
    }
  }

  function submitBulk() {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.split(",")[0].trim())
      .filter(Boolean);
    if (!lines.length) return toast.error("Paste at least one URL");
    bulkMut.mutate({ data: { urls: lines } });
  }

  const filtered = urls.filter((u) => {
    const matchesSearch =
      !search ||
      u.original_url.toLowerCase().includes(search.toLowerCase()) ||
      u.short_code.toLowerCase().includes(search.toLowerCase()) ||
      (u.custom_alias && u.custom_alias.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    const isExpired = u.expiry_date && new Date(u.expiry_date) < new Date();
    if (filter === "active") return !isExpired;
    if (filter === "expired") return isExpired;
    return true;
  });

  const totalClicks = urls.reduce((s, u) => s + (u.click_count ?? 0), 0);
  const activeLinks = urls.filter((u) => !u.expiry_date || new Date(u.expiry_date) > new Date()).length;
  const expiredCount = urls.length - activeLinks;

  return (
    <div className="min-h-screen bg-background">
      <AppNav email={email} />
      <main className="max-w-7xl mx-auto px-6 py-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Your links</h1>
            <p className="text-sm text-muted-foreground mt-1">Create, manage and analyze your short URLs.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBulk(true)}
              className="text-sm font-medium border border-border px-4 h-10 rounded-md hover:bg-muted transition flex items-center gap-2 cursor-pointer bg-surface"
            >
              <Upload className="size-4 text-muted-foreground" />
              Bulk
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm font-medium bg-brand text-brand-foreground px-4 h-10 rounded-md hover:brightness-105 transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="size-4" />
              New link
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total URLs" value={urls.length} />
          <StatCard label="Total clicks" value={totalClicks} />
          <StatCard label="Active" value={activeLinks} />
          <StatCard label="Expired" value={expiredCount} />
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-grow max-w-sm">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search URLs..."
              className="pl-9 h-10 w-full bg-surface border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div className="flex items-center justify-end">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="h-10 px-3 bg-surface border border-input rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {/* Table Panel */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading URLs…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-foreground">No links found</p>
              <p className="text-xs text-muted-foreground mt-1">Create a new short link to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Short</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Original</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider text-right">Clicks</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Created</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Expires</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((u) => {
                    const isExpired = u.expiry_date && new Date(u.expiry_date) < new Date();
                    return (
                      <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <a
                              href={`/r/${u.short_code}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand hover:underline font-mono text-sm font-medium"
                            >
                              /{u.short_code}
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(shortUrl(u.short_code));
                                toast.success("Copied to clipboard!");
                              }}
                              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/60 transition cursor-pointer"
                              title="Copy short URL"
                            >
                              <Copy className="size-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-[280px] md:max-w-[400px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-foreground truncate block" title={u.original_url}>
                              {u.original_url}
                            </span>
                            <a
                              href={u.original_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap font-mono text-sm text-foreground">
                          {u.click_count.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {u.expiry_date ? (
                            <span className={isExpired ? "text-destructive font-medium" : "text-muted-foreground"}>
                              {formatDate(u.expiry_date)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2.5">
                            <button
                              onClick={() => setQrCode(shortUrl(u.short_code))}
                              className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded hover:bg-muted/60 transition"
                              title="QR Code"
                            >
                              <QrCode className="size-4" />
                            </button>
                            <Link
                              to="/analytics/$id"
                              params={{ id: u.id }}
                              className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded hover:bg-muted/60 transition"
                              title="Analytics"
                            >
                              <BarChart3 className="size-4" />
                            </Link>
                            <button
                              onClick={() => {
                                setEditLink(u);
                                setEditOriginalUrl(u.original_url);
                                setEditExpiry(u.expiry_date ? u.expiry_date.slice(0, 16) : "");
                              }}
                              className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded hover:bg-muted/60 transition"
                              title="Edit link"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              onClick={() => confirm("Are you sure you want to delete this link?") && delMut.mutate({ data: { id: u.id } })}
                              className="text-destructive hover:opacity-85 cursor-pointer p-1 rounded hover:bg-destructive/10 transition"
                              title="Delete link"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* QR Code Dialog */}
      {qrCode && <QrDialog url={qrCode} onClose={() => setQrCode(null)} />}

      {/* Create Short URL Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-xs grid place-items-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-surface rounded-xl border border-border p-6 max-w-md w-full shadow-lg relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowCreate(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md"
            >
              <X className="size-4" />
            </button>

            <h3 className="text-lg font-semibold text-foreground mb-1">Create short URL</h3>
            <p className="text-sm text-muted-foreground mb-6">Paste a long URL, optionally pick an alias and expiry.</p>

            <form onSubmit={submitCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Long URL</label>
                <input
                  value={longUrl}
                  onChange={(e) => setLongUrl(e.target.value)}
                  placeholder="https://example.com/very/long/url"
                  required
                  className="w-full h-10 px-3 bg-surface border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Custom alias (optional)</label>
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="my-link"
                  className="w-full h-10 px-3 bg-surface border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Expiry</label>
                <div className="relative">
                  <select
                    value={expiryType}
                    onChange={(e) => setExpiryType(e.target.value as any)}
                    className="w-full h-10 px-3 bg-surface border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer appearance-none"
                  >
                    <option value="never">Never</option>
                    <option value="custom">Custom date</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 size-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {expiryType === "custom" && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Expiry Date & Time</label>
                  <input
                    type="datetime-local"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-surface border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending}
                  className="px-4 py-2 text-sm bg-brand text-brand-foreground rounded-md hover:brightness-105 disabled:opacity-50 cursor-pointer font-medium"
                >
                  {createMut.isPending ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Short URL Modal */}
      {editLink && (
        <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-xs grid place-items-center p-4" onClick={() => setEditLink(null)}>
          <div className="bg-surface rounded-xl border border-border p-6 max-w-md w-full shadow-lg relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setEditLink(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md"
            >
              <X className="size-4" />
            </button>

            <h3 className="text-lg font-semibold text-foreground mb-4">Edit link</h3>

            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Original URL</label>
                <input
                  value={editOriginalUrl}
                  onChange={(e) => setEditOriginalUrl(e.target.value)}
                  required
                  className="w-full h-10 px-3 bg-surface border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Expiry (leave blank for none)</label>
                <input
                  type="datetime-local"
                  value={editExpiry}
                  onChange={(e) => setEditExpiry(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setEditLink(null)}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMut.isPending}
                  className="px-4 py-2 text-sm bg-brand text-brand-foreground rounded-md hover:brightness-105 disabled:opacity-50 cursor-pointer font-medium"
                >
                  {updateMut.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-xs grid place-items-center p-4" onClick={() => setShowBulk(false)}>
          <div className="bg-surface rounded-xl border border-border p-6 max-w-lg w-full shadow-lg relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowBulk(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md"
            >
              <X className="size-4" />
            </button>

            <h3 className="text-lg font-semibold text-foreground mb-1">Bulk shorten</h3>
            <p className="text-xs text-muted-foreground mb-4">One URL per line. Up to 200. We'll auto-download a CSV with the short links.</p>
            
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={8}
              className="w-full p-3 bg-background border border-input rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/40"
              placeholder="https://example.com/a&#10;https://example.com/b"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowBulk(false)} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted cursor-pointer">Cancel</button>
              <button onClick={submitBulk} disabled={bulkMut.isPending} className="px-4 py-2 text-sm bg-brand text-brand-foreground rounded-md hover:brightness-105 disabled:opacity-50 cursor-pointer font-medium">
                {bulkMut.isPending ? "Working…" : "Shorten all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface p-5 rounded-xl border border-border">
      <p className="text-xs font-semibold text-muted-foreground mb-3">{label}</p>
      <p className="text-3xl font-semibold text-foreground tracking-tight">{value}</p>
    </div>
  );
}
