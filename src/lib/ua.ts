// Lightweight User-Agent parser for analytics. Worker-safe (no deps).
export function parseUserAgent(ua: string | null | undefined) {
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
