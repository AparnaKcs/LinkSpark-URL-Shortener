import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public stats — no auth required. Uses admin client to bypass RLS but returns
// only non-sensitive fields. Falls back to mockDb in smoke-test/local mode.
export const getPublicStats = createServerFn({ method: "GET" })
  .inputValidator((d: { shortCode: string }) =>
    z.object({ shortCode: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    let url: any = null;
    let isMock = false;

    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row, error } = await supabaseAdmin
          .from("urls")
          .select("id, short_code, click_count, created_at, last_visited_at, expiry_date")
          .eq("short_code", data.shortCode)
          .maybeSingle();
        if (error) throw new Error(error.message);
        url = row;
      }
    } catch (err: any) {
      console.warn("Could not query Supabase admin client for stats, trying mockDb:", err.message);
    }

    if (!url) {
      const { mockDb } = await import("./db.mock");
      const mockUrl = mockDb.getUrlByCode(data.shortCode);
      if (mockUrl) {
        url = {
          id: mockUrl.id,
          short_code: mockUrl.short_code,
          click_count: mockUrl.click_count,
          created_at: mockUrl.created_at,
          last_visited_at: mockUrl.last_visited_at,
          expiry_date: mockUrl.expiry_date,
        };
        isMock = true;
      }
    }

    if (!url) return { url: null, daily: [] as { day: string; clicks: number }[] };

    let visits: { timestamp: string }[] = [];

    if (isMock || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { mockDb } = await import("./db.mock");
      visits = mockDb.getVisits(url.id);
    } else {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: rows } = await supabaseAdmin
          .from("visits")
          .select("timestamp")
          .eq("url_id", url.id)
          .gte("timestamp", since);
        visits = rows ?? [];
      } catch (err) {
        console.error("Failed to query public visits from Supabase:", err);
      }
    }

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
