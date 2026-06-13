import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { getPublicStats } from "@/lib/stats.functions";
import { Link2 } from "lucide-react";

export const Route = createFileRoute("/stats/$shortCode")({
  head: ({ params }) => ({
    meta: [
      { title: `Stats /${params.shortCode} — Snip` },
      { name: "description", content: `Public click analytics for /r/${params.shortCode}` },
    ],
  }),
  component: PublicStats,
});

function PublicStats() {
  const { shortCode } = Route.useParams();
  const fn = useServerFn(getPublicStats);
  const { data, isLoading } = useQuery({
    queryKey: ["public-stats", shortCode],
    queryFn: () => fn({ data: { shortCode } }),
  });

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-brand">
            <Link2 className="size-5" />
            <span className="font-semibold tracking-tight text-foreground">Snip</span>
          </Link>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Public Stats
          </span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.url ? (
          <div className="text-center py-20">
            <h1 className="text-xl font-semibold">Link not found</h1>
            <p className="text-sm text-muted-foreground mt-2">No link exists at /r/{shortCode}</p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Public analytics for
              </p>
              <h1 className="text-3xl font-semibold tracking-tight mt-1 font-mono">
                /r/{data.url.short_code}
              </h1>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <Stat label="Total Clicks" value={data.url.click_count.toLocaleString()} />
              <Stat label="Created" value={new Date(data.url.created_at).toLocaleDateString()} />
              <Stat
                label="Last Visit"
                value={
                  data.url.last_visited_at
                    ? new Date(data.url.last_visited_at).toLocaleString()
                    : "—"
                }
              />
            </div>

            <div className="bg-surface ring-1 ring-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Daily clicks (30 days)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={data.daily.map((d) => ({ day: d.day.slice(5), clicks: d.clicks }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="oklch(0.72 0.17 162)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-4 rounded-xl ring-1 ring-border">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-2xl font-mono font-medium">{value}</p>
    </div>
  );
}
