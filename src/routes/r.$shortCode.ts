import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/r/$shortCode")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const code = params.shortCode;
        const expressUrl = `${process.env.EXPRESS_API_URL || "http://localhost:3000"}/r/${code}`;

        const headers = new Headers();
        
        // Forward User-Agent and client IP headers to Express for correct analytics tracking
        const ua = request.headers.get("user-agent");
        if (ua) headers.set("user-agent", ua);

        const xff = request.headers.get("x-forwarded-for");
        if (xff) headers.set("x-forwarded-for", xff);

        const cfConnectingIp = request.headers.get("cf-connecting-ip");
        if (cfConnectingIp) headers.set("cf-connecting-ip", cfConnectingIp);

        const cfIpCountry = request.headers.get("cf-ipcountry");
        if (cfIpCountry) headers.set("cf-ipcountry", cfIpCountry);

        try {
          const res = await fetch(expressUrl, {
            method: "GET",
            headers,
            redirect: "manual",
          });

          if (res.status === 302 || res.status === 301) {
            const location = res.headers.get("location");
            return new Response(null, {
              status: 302,
              headers: { Location: location || "/", "cache-control": "no-store" },
            });
          }

          const body = await res.text();
          return new Response(body, {
            status: res.status,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        } catch (err: any) {
          console.error("Express redirect proxy error:", err);
          return new Response(
            `<!doctype html><html><head><meta charset="utf-8"><title>Error</title></head>
            <body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#f4f0ec;color:#000000">
            <div style="text-align:center"><h1>Internal Server Error</h1><p>Could not connect to backend server.</p></div>
            </body></html>`,
            {
              status: 500,
              headers: { "content-type": "text/html; charset=utf-8" },
            }
          );
        }
      },
    },
  },
});
