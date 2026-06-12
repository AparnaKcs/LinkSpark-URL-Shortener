import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";
import { AppNav } from "@/components/app-nav";
import { getAnalytics } from "@/lib/urls.functions";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics/$id")({
  head: () => ({ meta: [{ title: "Analytics — Snip" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", id],
    queryFn: () => fn({ data: { id } }),
  });
  const [email] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav email={email} />
        <div className="max-w-7xl mx-auto px-6 py-10 text-sm text-muted-foreground">Loading analytics…</div>
      </div>
    );
  }

  const { url, visits } = data;
  const shortUrl = typeof window !== "undefined" ? `${window.location.origin}/r/${url.short_code}` : `/r/${url.short_code}`;

  // Time boundaries
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const todayClicks = visits.filter((v) => now - new Date(v.timestamp).getTime() < dayMs).length;
  const weekClicks = visits.filter((v) => now - new Date(v.timestamp).getTime() < 7 * dayMs).length;
  const monthClicks = visits.filter((v) => now - new Date(v.timestamp).getTime() < 30 * dayMs).length;

  // Daily click trend (last 30 days)
  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * dayMs).toISOString().slice(0, 10);
    buckets.set(d, 0);
  }
  visits.forEach((v) => {
    const day = (v.timestamp as string).slice(0, 10);
    if (buckets.has(day)) buckets.set(day, buckets.get(day)! + 1);
  });
  const daily = Array.from(buckets.entries()).map(([day, clicks]) => ({ day: day.slice(5), clicks }));

  // Distributions
  const browserCounts = countBy(visits, (v) => v.browser ?? "Unknown");
  const deviceCounts = countBy(visits, (v) => v.device ?? "Unknown");
  const countryCounts = countBy(visits, (v) => v.country ?? "Unknown");

  return (
    <div className="min-h-screen bg-background">
      <AppNav email={email} />
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        
        {/* Header */}
        <div>
          <Link
            to="/dashboard"
            className="text-sm font-medium hover:opacity-85 text-foreground flex items-center gap-1.5 cursor-pointer select-none mb-6"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-mono">
            /{url.short_code}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 break-all font-mono">
            {url.original_url}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total clicks" value={url.click_count.toLocaleString()} />
          <Stat label="Today" value={todayClicks} />
          <Stat label="This week" value={weekClicks} />
          <Stat label="This month" value={monthClicks} />
        </div>

        {/* Click Trend Chart */}
        <Card title="Click trend (30 days)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="clicks" stroke="oklch(0.55 0.18 250)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Distributions Section */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card title="Browsers">
            <Bars data={browserCounts} />
          </Card>
          <Card title="Devices">
            <Bars data={deviceCounts} />
          </Card>
          <Card title="Top countries">
            <Bars data={countryCounts} />
          </Card>
        </div>

        {/* Recent Visits Table */}
        <Card title="Recent visits">
          {visits.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No clicks yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider border-b border-border bg-muted/20">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Browser</th>
                    <th className="px-4 py-3">Device</th>
                    <th className="px-4 py-3">OS</th>
                    <th className="px-4 py-3">Country</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-muted-foreground">
                  {visits.slice(0, 50).map((v) => (
                    <tr key={v.id} className="hover:bg-muted/5 transition-colors">
                      <td className="px-4 py-2.5 text-foreground font-medium">{new Date(v.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-2.5">{v.browser ?? "—"}</td>
                      <td className="px-4 py-2.5">{v.device ?? "—"}</td>
                      <td className="px-4 py-2.5">{v.os ?? "—"}</td>
                      <td className="px-4 py-2.5">{v.country ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-xs">
      <h3 className="text-sm font-semibold mb-4 text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface p-5 rounded-xl border border-border shadow-xs">
      <p className="text-xs font-semibold text-muted-foreground mb-3">{label}</p>
      <p className="text-3xl font-semibold text-foreground tracking-tight">{value}</p>
    </div>
  );
}

function Bars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">No data yet.</p>;
  }
  return (
    <div className="space-y-4">
      {data.slice(0, 5).map((d) => (
        <div key={d.label}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground font-medium">{d.label}</span>
            <span className="font-mono text-foreground font-semibold">{d.count}</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

type Visit = { id: string; timestamp: string; browser: string | null; device: string | null; os: string | null; country: string | null };

function countBy(items: Visit[], key: (v: Visit) => string) {
  const m = new Map<string, number>();
  items.forEach((it) => { const k = key(it); m.set(k, (m.get(k) ?? 0) + 1); });
  return Array.from(m.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}
