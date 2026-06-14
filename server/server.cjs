const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { nanoid } = require('nanoid');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  console.error("Missing SUPABASE_URL in environment variables.");
  process.exit(1);
}

// Admin client for redirects & public stats (bypasses RLS limits for logging)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: { persistSession: false }
});

// Middleware to authenticate user requests using Supabase JWT
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    // Create an request-specific client with the user's token
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    });

    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    req.user = user;
    req.db = client; // Enforces RLS database policies automatically!
    next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// User-Agent parser helper for analytics logging
function parseUserAgent(ua) {
  const s = ua ?? "";
  let browser = "Unknown";
  if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/Chrome\//.test(s) && !/Chromium/.test(s)) browser = "Chrome";
  else if (/Safari\//.test(s) && !/Chrome|Chromium/.test(s)) browser = "Safari";
  else if (/Firefox\//.test(s)) browser = "Firefox";

  let os = "Unknown";
  if (/Windows NT/.test(s)) os = "Windows";
  else if (/Mac OS X/.test(s)) os = "macOS";
  else if (/Android/.test(s)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(s)) os = "iOS";
  else if (/Linux/.test(s)) os = "Linux";

  let device = "Desktop";
  if (/iPad|Tablet/.test(s)) device = "Tablet";
  else if (/Mobi|Android|iPhone/.test(s)) device = "Mobile";

  return { browser, os, device };
}

// 1. Server-side redirect endpoint
app.get('/r/:shortCode', async (req, res) => {
  const code = req.params.shortCode;

  try {
    const { data: url, error } = await supabaseAdmin
      .from('urls')
      .select('id, original_url, expiry_date')
      .eq('short_code', code)
      .maybeSingle();

    if (error || !url) {
      return res.status(404).send(notFoundHtml("Link not found"));
    }

    if (url.expiry_date && new Date(url.expiry_date) < new Date()) {
      return res.status(410).send(notFoundHtml("This link has expired."));
    }

    // Record visit details
    const ua = req.headers['user-agent'];
    const { browser, os, device } = parseUserAgent(ua);
    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;
    
    let countryName = req.headers['cf-ipcountry'] || null;
    let cityName = null;

    // Optional IP geolocation lookup
    if (!countryName || countryName === "XX") {
      try {
        const isLocal = !ip || ip === "127.0.0.1" || ip === "::1" || ip.includes("127.0.0.1");
        const endpoint = isLocal ? `http://ip-api.com/json/` : `http://ip-api.com/json/${ip}`;
        const geoRes = await fetch(endpoint);
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (geo && geo.status === 'success') {
            countryName = geo.country || countryName;
            cityName = geo.city || null;
          }
        }
      } catch (e) {
        console.error("IP Geolocation lookup failed:", e);
      }
    }

    // Insert visit
    await supabaseAdmin.from('visits').insert({
      url_id: url.id,
      ip_address: ip,
      browser,
      device,
      os,
      country: countryName,
      city: cityName,
    });

    res.redirect(302, url.original_url);
  } catch (err) {
    console.error(err);
    res.status(500).send(notFoundHtml("Internal Server Error"));
  }
});

// 2. GET /api/urls - List user shortened links
app.get('/api/urls', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('urls')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2b. GET /api/urls/:id - Get a specific user shortened link
app.get('/api/urls/:id', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('urls')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/urls - Create a new shortened link
const createSchema = z.object({
  original_url: z.string().trim().url().max(2048),
  custom_alias: z.string().trim().regex(/^[a-zA-Z0-9_-]{3,32}$/).optional().nullable(),
  expiry_date: z.string().datetime().optional().nullable(),
});

app.post('/api/urls', authenticateToken, async (req, res) => {
  try {
    const data = createSchema.parse(req.body);
    const short_code = data.custom_alias?.trim() || nanoid(7);

    // Uniqueness check using admin client
    const { data: existing } = await supabaseAdmin
      .from('urls')
      .select('id')
      .or(`short_code.eq.${short_code},custom_alias.eq.${short_code}`)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'That short code or alias is already taken.' });
    }

    const { data: row, error } = await req.db
      .from('urls')
      .insert({
        user_id: req.user.id,
        original_url: data.original_url,
        short_code,
        custom_alias: data.custom_alias ?? null,
        expiry_date: data.expiry_date ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(row);
  } catch (err) {
    res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
  }
});

// 4. PATCH /api/urls/:id - Edit shortened link
const updateSchema = z.object({
  original_url: z.string().trim().url().max(2048).optional(),
  expiry_date: z.string().datetime().nullable().optional(),
});

app.patch('/api/urls/:id', authenticateToken, async (req, res) => {
  try {
    const data = updateSchema.parse(req.body);
    const { data: row, error } = await req.db
      .from('urls')
      .update(data)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(row);
  } catch (err) {
    res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
  }
});

// 5. DELETE /api/urls/:id - Delete a link
app.delete('/api/urls/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await req.db
      .from('urls')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. GET /api/urls/:id/analytics - Get details and visits
app.get('/api/urls/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const { data: url, error: urlErr } = await req.db
      .from('urls')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (urlErr) throw urlErr;

    const { data: visits, error: visErr } = await req.db
      .from('visits')
      .select('*')
      .eq('url_id', req.params.id)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (visErr) throw visErr;

    res.json({ url, visits: visits || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/urls/bulk - Bulk shorten links
const bulkSchema = z.object({
  urls: z.array(z.string().trim().url().max(2048)).min(1).max(200),
});

app.post('/api/urls/bulk', authenticateToken, async (req, res) => {
  try {
    const data = bulkSchema.parse(req.body);
    const rows = data.urls.map((u) => ({
      user_id: req.user.id,
      original_url: u,
      short_code: nanoid(7),
    }));

    const { data: inserted, error } = await req.db
      .from('urls')
      .insert(rows)
      .select();

    if (error) throw error;
    res.json(inserted);
  } catch (err) {
    res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
  }
});

// 8. GET /api/stats/:shortCode - Public statistics
app.get('/api/stats/:shortCode', async (req, res) => {
  try {
    const { data: url, error: urlErr } = await supabaseAdmin
      .from('urls')
      .select('id, short_code, click_count, created_at, last_visited_at')
      .eq('short_code', req.params.shortCode)
      .maybeSingle();

    if (urlErr || !url) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const { data: visits, error: visErr } = await supabaseAdmin
      .from('visits')
      .select('timestamp')
      .eq('url_id', url.id)
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (visErr) throw visErr;

    // Group click trends by day
    const dailyMap = new Map();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 29; i >= 0; i--) {
      const dateStr = new Date(now - i * dayMs).toISOString().slice(0, 10);
      dailyMap.set(dateStr, 0);
    }

    visits?.forEach((v) => {
      const day = new Date(v.timestamp).toISOString().slice(0, 10);
      if (dailyMap.has(day)) {
        dailyMap.set(day, dailyMap.get(day) + 1);
      }
    });

    const daily = Array.from(dailyMap.entries()).map(([day, clicks]) => ({
      day,
      clicks,
    }));

    res.json({ url, daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HTML helper for 404/410 pages
function notFoundHtml(msg) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${msg}</title>
  <style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#f4f0ec;color:#000000}
  .box{text-align:center}.box h1{font-size:1.5rem;font-weight:600;margin:0 0 .5rem}
  .box p{color:#737373;margin:0 0 1rem}.box a{color:#d62300;text-decoration:none;font-weight:500}</style>
  </head><body><div class="box"><h1>${msg}</h1><p>The link you followed isn't available.</p><a href="/">Go home</a></div></body></html>`;
}

app.listen(port, () => {
  console.log(`Express server running on port ${port}`);
});
