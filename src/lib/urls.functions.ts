import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ALIAS_RE = /^[a-zA-Z0-9_-]{3,32}$/;

const getApiUrl = (path: string) => {
  const base = process.env.EXPRESS_API_URL || "http://localhost:3000";
  return `${base}${path}`;
};

async function fetchFromExpress(path: string, options: RequestInit = {}) {
  const req = getRequest();
  const authHeader = req?.headers?.get("authorization");

  const headers = new Headers(options.headers);
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(getApiUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = "API request failed";
    try {
      const errorJson = await response.json();
      if (errorJson?.error) errorMsg = errorJson.error;
    } catch {
      try {
        const text = await response.text();
        if (text) errorMsg = text;
      } catch {}
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

const createSchema = z.object({
  original_url: z.string().trim().url().max(2048),
  custom_alias: z.string().trim().regex(ALIAS_RE).optional().nullable(),
  expiry_date: z.string().datetime().optional().nullable(),
});

export const createUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => {
    return fetchFromExpress("/api/urls", {
      method: "POST",
      body: JSON.stringify(data),
    });
  });

export const listUrls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return fetchFromExpress("/api/urls");
  });

export const getUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    return fetchFromExpress(`/api/urls/${data.id}`);
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  original_url: z.string().trim().url().max(2048).optional(),
  expiry_date: z.string().datetime().nullable().optional(),
});

export const updateUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data }) => {
    const { id, ...patch } = data;
    return fetchFromExpress(`/api/urls/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  });

export const deleteUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    return fetchFromExpress(`/api/urls/${data.id}`, {
      method: "DELETE",
    });
  });

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    return fetchFromExpress(`/api/urls/${data.id}/analytics`);
  });

const bulkSchema = z.object({
  urls: z.array(z.string().trim().url().max(2048)).min(1).max(200),
});

export const bulkShorten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkSchema.parse(d))
  .handler(async ({ data }) => {
    return fetchFromExpress("/api/urls/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    });
  });
