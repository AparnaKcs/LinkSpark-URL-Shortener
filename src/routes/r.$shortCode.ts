import { createFileRoute } from "@tanstack/react-router";
import { parseUserAgent } from "@/lib/ua";

// Server-side redirect endpoint. Records a visit, increments click count,
// then 302-redirects to the original URL.
export const Route = createFileRoute("/r/$shortCode")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const code = params.shortCode;
        let url: {
          id: string;
          original_url: string;
          expiry_date: string | null;
          click_count: number;
        } | null = null;
        let isMockUrl = false;

        try {
          if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await supabaseAdmin
              .from("urls")
              .select("id, original_url, expiry_date, click_count")
              .eq("short_code", code)
              .maybeSingle();
            url = data;
          }
        } catch (err: any) {
          console.warn("Could not query Supabase admin client, trying mockDb:", err.message);
        }

        if (!url) {
          const { mockDb } = await import("@/lib/db.mock");
          const mockUrl = mockDb.getUrlByCode(code);
          if (mockUrl) {
            url = {
              id: mockUrl.id,
              original_url: mockUrl.original_url,
              expiry_date: mockUrl.expiry_date,
              click_count: mockUrl.click_count,
            };
            isMockUrl = true;
          }
        }

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

        // Record visit
        const ua = request.headers.get("user-agent");
        const { browser, os, device } = parseUserAgent(ua);
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;
        
        let countryName = request.headers.get("cf-ipcountry") ?? null;
        let cityName = null;

        if (!countryName || countryName === "XX") {
          try {
            const isLocal = !ip || 
              ip === "127.0.0.1" || 
              ip === "::1" || 
              ip.includes("127.0.0.1") || 
              ip.startsWith("::ffff:127.") ||
              ip.startsWith("192.168.") || 
              ip.startsWith("10.") || 
              ip.startsWith("fe80");

            const endpoint = isLocal
              ? `http://ip-api.com/json/`
              : `http://ip-api.com/json/${ip}`;

            const res = await fetch(endpoint);
            if (res.ok) {
              const geo = await res.json();
              if (geo && geo.status === "success") {
                countryName = geo.country || countryName;
                cityName = geo.city || null;
              }
            }
          } catch (e) {
            console.error("IP Geolocation lookup failed:", e);
          }
        }

        if (isMockUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const { mockDb } = await import("@/lib/db.mock");
          mockDb.addVisit({
            url_id: url.id,
            ip_address: ip,
            browser,
            device,
            os,
            country: countryName,
            city: cityName,
          });
        } else {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("visits").insert({
              url_id: url.id,
              ip_address: ip,
              browser,
              device,
              os,
              country: countryName,
              city: cityName,
            });
          } catch (err) {
            console.error("Failed to write redirect tracking to Supabase:", err);
          }
        }

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
