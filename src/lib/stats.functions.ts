import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public stats — no auth required. Uses admin client to bypass RLS but returns
// only non-sensitive fields.
export const getPublicStats = createServerFn({ method: "GET" })
  .inputValidator((d: { shortCode: string }) =>
    z.object({ shortCode: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: url, error } = await supabaseAdmin
      .from("urls")
      .select("id, short_code, click_count, created_at, last_visited_at, expiry_date")
      .eq("short_code", data.shortCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!url) return { url: null, daily: [] as { day: string; clicks: number }[] };

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: visits } = await supabaseAdmin
      .from("visits")
      .select("timestamp")
      .eq("url_id", url.id)
      .gte("timestamp", since);

    const buckets = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const v of visits ?? []) {
      const day = (v.timestamp as string).slice(0, 10);
      if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
    }
    const daily = Array.from(buckets.entries()).map(([day, clicks]) => ({ day, clicks }));
    return { url, daily };
  });
