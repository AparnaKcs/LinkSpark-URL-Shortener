import * as fs from "fs";
import * as path from "path";

export interface MockUrl {
  id: string;
  user_id: string;
  original_url: string;
  short_code: string;
  custom_alias: string | null;
  click_count: number;
  last_visited_at: string | null;
  expiry_date: string | null;
  created_at: string;
}

export interface MockVisit {
  id: string;
  url_id: string;
  timestamp: string;
  ip_address: string | null;
  browser: string | null;
  device: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
}

interface MockSchema {
  urls: MockUrl[];
  visits: MockVisit[];
}

const dbPath = path.resolve(process.cwd(), "mock-db.json");

function readDb(): MockSchema {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading mock database:", e);
  }
  return { urls: [], visits: [] };
}

function writeDb(data: MockSchema) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing mock database:", e);
  }
}

export const mockDb = {
  getUrls(userId: string): MockUrl[] {
    const db = readDb();
    return db.urls.filter((u) => u.user_id === userId);
  },

  getUrlById(id: string): MockUrl | null {
    const db = readDb();
    return db.urls.find((u) => u.id === id) ?? null;
  },

  getUrlByCode(code: string): MockUrl | null {
    const db = readDb();
    return db.urls.find((u) => u.short_code === code) ?? null;
  },

  addUrl(
    url: Omit<MockUrl, "id" | "click_count" | "last_visited_at" | "created_at"> & { id?: string },
  ): MockUrl {
    const db = readDb();
    const newUrl: MockUrl = {
      id: url.id || crypto.randomUUID(),
      click_count: 0,
      last_visited_at: null,
      created_at: new Date().toISOString(),
      ...url,
    };
    db.urls.push(newUrl);
    writeDb(db);
    return newUrl;
  },

  updateUrl(id: string, patch: Partial<Omit<MockUrl, "id" | "created_at">>): MockUrl | null {
    const db = readDb();
    const idx = db.urls.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    const updated = { ...db.urls[idx], ...patch };
    db.urls[idx] = updated;
    writeDb(db);
    return updated;
  },

  deleteUrl(id: string): boolean {
    const db = readDb();
    const originalLength = db.urls.length;
    db.urls = db.urls.filter((u) => u.id !== id);
    db.visits = db.visits.filter((v) => v.url_id !== id);
    writeDb(db);
    return db.urls.length < originalLength;
  },

  getVisits(urlId: string): MockVisit[] {
    const db = readDb();
    return db.visits.filter((v) => v.url_id === urlId);
  },

  addVisit(visit: Omit<MockVisit, "id" | "timestamp">): MockVisit {
    const db = readDb();
    const newVisit: MockVisit = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...visit,
    };
    db.visits.push(newVisit);

    // Update click count and last visited at
    const urlIdx = db.urls.findIndex((u) => u.id === visit.url_id);
    if (urlIdx !== -1) {
      db.urls[urlIdx].click_count += 1;
      db.urls[urlIdx].last_visited_at = newVisit.timestamp;
    }

    writeDb(db);
    return newVisit;
  },
};
