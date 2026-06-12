import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nanoid } from "nanoid";
import { z } from "zod";

const ALIAS_RE = /^[a-zA-Z0-9_-]{3,32}$/;

const createSchema = z.object({
  original_url: z.string().trim().url().max(2048),
  custom_alias: z.string().trim().regex(ALIAS_RE).optional().nullable(),
  expiry_date: z.string().datetime().optional().nullable(),
});

export const createUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const short_code = data.custom_alias?.trim() || nanoid(7);

    // Uniqueness check
    const { data: existing } = await supabase
      .from("urls")
      .select("id")
      .or(`short_code.eq.${short_code},custom_alias.eq.${short_code}`)
      .maybeSingle();
    if (existing) throw new Error("That short code or alias is already taken.");

    const { data: row, error } = await supabase
      .from("urls")
      .insert({
        user_id: userId,
        original_url: data.original_url,
        short_code,
        custom_alias: data.custom_alias ?? null,
        expiry_date: data.expiry_date ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listUrls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("urls")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("urls")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  original_url: z.string().trim().url().max(2048).optional(),
  expiry_date: z.string().datetime().nullable().optional(),
});
export const updateUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("urls").update(patch).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("urls").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: url, error: urlErr } = await supabase
      .from("urls").select("*").eq("id", data.id).single();
    if (urlErr) throw new Error(urlErr.message);

    const { data: visits, error: visErr } = await supabase
      .from("visits").select("*").eq("url_id", data.id)
      .order("timestamp", { ascending: false }).limit(500);
    if (visErr) throw new Error(visErr.message);

    return { url, visits: visits ?? [] };
  });

const bulkSchema = z.object({
  urls: z.array(z.string().trim().url().max(2048)).min(1).max(200),
});
export const bulkShorten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.urls.map((u) => ({
      user_id: userId,
      original_url: u,
      short_code: nanoid(7),
    }));
    const { data: inserted, error } = await supabase.from("urls").insert(rows).select();
    if (error) throw new Error(error.message);
    return inserted;
  });
