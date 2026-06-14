import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const getApiUrl = (path: string) => {
  const base = process.env.EXPRESS_API_URL || "http://localhost:3000";
  return `${base}${path}`;
};

export const getPublicStats = createServerFn({ method: "GET" })
  .inputValidator((d: { shortCode: string }) =>
    z.object({ shortCode: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    const response = await fetch(getApiUrl(`/api/stats/${data.shortCode}`));
    if (!response.ok) {
      let errorMsg = "Stats request failed";
      try {
        const errorJson = await response.json();
        if (errorJson?.error) errorMsg = errorJson.error;
      } catch {}
      throw new Error(errorMsg);
    }
    return response.json();
  });
