import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";
import { AppNav } from "@/components/app-nav";
import { getAnalytics } from "@/lib/urls.functions";

export const Route = createFileRoute("/_authenticated/analytics/$id")({
  head: () => ({ meta: [{ title: "Analytics — Vektor" }] }),
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

  // Daily clicks (last 30 days)
  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    buckets.set(d, 0);
  }
  visits.forEach((v) => {
    const day = (v.timestamp as string).slice(0, 10);
    if (buckets.has(day)) buckets.set(day, buckets.get(day)! + 1);
  });
  const daily = Array.from(buckets.entries()).map(([day, clicks]) => ({ day: day.slice(5), clicks }));

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayClicks = buckets.get(todayKey) ?? 0;
  const weekClicks = Array.from(buckets.entries()).slice(-7).reduce((s, [, c]) => s + c, 0);

  const browserCounts = countBy(visits, (v) => v.browser ?? "Unknown");
  const deviceCounts = countBy(visits, (v) => v.device ?? "Unknown");

  return (
    <div className="min-h-screen bg-background">
      <AppNav email={email} />
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div>
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">Analytics</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1 break-all">
            {shortUrl} → <span className="text-foreground">{url.original_url}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total Clicks" value={url.click_count.toLocaleString()} />
          <Stat label="Today" value={String(todayClicks)} />
          <Stat label="Last 7d" value={String(weekClicks)} />
          <Stat label="Last Visit" value={url.last_visited_at ? new Date(url.last_visited_at).toLocaleString() : "—"} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="Daily click trend (30d)">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="clicks" stroke="oklch(0.72 0.17 162)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Hourly throughput (24h)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hourly(visits)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="clicks" fill="oklch(0.72 0.17 162)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="Browser distribution"><Bars data={browserCounts} /></Card>
          <Card title="Device distribution"><Bars data={deviceCounts} /></Card>
        </div>

        <Card title="Recent visits">
          {visits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No visits yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[11px] font-medium uppercase text-muted-foreground">
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Browser</th>
                    <th className="px-3 py-2">Device</th>
                    <th className="px-3 py-2">OS</th>
                    <th className="px-3 py-2">Country</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {visits.slice(0, 50).map((v) => (
                    <tr key={v.id}>
                      <td className="px-3 py-2">{new Date(v.timestamp).toLocaleString()}</td>
                      <td className="px-3 py-2">{v.browser ?? "—"}</td>
                      <td className="px-3 py-2">{v.device ?? "—"}</td>
                      <td className="px-3 py-2">{v.os ?? "—"}</td>
                      <td className="px-3 py-2">{v.country ?? "—"}</td>
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
    <div className="bg-surface ring-1 ring-border rounded-xl p-5">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-4 rounded-xl ring-1 ring-border">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-mono font-medium">{value}</p>
    </div>
  );
}

function Bars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data yet.</p>;
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-mono">{d.count}</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
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

function hourly(visits: Visit[]) {
  const now = Date.now();
  const buckets = new Map<string, number>();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now - i * 3600000);
    buckets.set(`${d.getHours().toString().padStart(2, "0")}:00`, 0);
  }
  visits.forEach((v) => {
    const t = new Date(v.timestamp);
    if (now - t.getTime() < 24 * 3600000) {
      const k = `${t.getHours().toString().padStart(2, "0")}:00`;
      if (buckets.has(k)) buckets.set(k, buckets.get(k)! + 1);
    }
  });
  return Array.from(buckets.entries()).map(([hour, clicks]) => ({ hour, clicks }));
}
