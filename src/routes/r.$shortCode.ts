import { createFileRoute } from "@tanstack/react-router";
import { parseUserAgent } from "@/lib/ua";

// Server-side redirect endpoint. Records a visit, increments click count,
// then 302-redirects to the original URL.
export const Route = createFileRoute("/r/$shortCode")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const code = params.shortCode;

        const { data: url } = await supabaseAdmin
          .from("urls")
          .select("id, original_url, expiry_date, click_count")
          .eq("short_code", code)
          .maybeSingle();

        if (!url) {
          return new Response(notFoundHtml("Link not found"), {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        if (url.expiry_date && new Date(url.expiry_date) < new Date()) {
          return new Response(notFoundHtml("This link has expired."), {
            status: 410,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        // Record visit (fire-and-forget; don't await CF country headers below)
        const ua = request.headers.get("user-agent");
        const { browser, os, device } = parseUserAgent(ua);
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;
        const country = request.headers.get("cf-ipcountry") ?? null;

        await Promise.all([
          supabaseAdmin.from("visits").insert({
            url_id: url.id,
            ip_address: ip,
            browser,
            device,
            os,
            country,
          }),
          supabaseAdmin
            .from("urls")
            .update({
              click_count: (url.click_count ?? 0) + 1,
              last_visited_at: new Date().toISOString(),
            })
            .eq("id", url.id),
        ]);

        return new Response(null, {
          status: 302,
          headers: { Location: url.original_url, "cache-control": "no-store" },
        });
      },
    },
  },
});

function notFoundHtml(msg: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${msg}</title>
  <style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafafa;color:#0a0a0a}
  .box{text-align:center}.box h1{font-size:1.5rem;font-weight:600;margin:0 0 .5rem}
  .box p{color:#737373;margin:0 0 1rem}.box a{color:#10b981;text-decoration:none;font-weight:500}</style>
  </head><body><div class="box"><h1>${msg}</h1><p>The link you followed isn't available.</p><a href="/">Go home</a></div></body></html>`;
}
