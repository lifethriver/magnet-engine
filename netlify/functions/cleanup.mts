/**
 * Netlify scheduled function, once a day: deletes reports older than the
 * owner's keepReportsDays setting (and the lead details stored on them), old
 * rate-limit counters, and stale URL pointers.
 */
import { kv } from "../../src/lib/store";
import { loadSettings } from "../../src/lib/settings-store";
import { dayStamp } from "../../src/lib/limits";

const cleanup = async (): Promise<void> => {
  const store = kv();
  const keepDays = (await loadSettings())?.settings.limits.keepReportsDays ?? 60;
  const reportCutoff = Date.now() - keepDays * 86_400_000;

  // Ids start with the creation time in base 36, so the age is in the key itself.
  for (const prefix of ["report/", "lead/"]) {
    for (const key of await store.list(prefix)) {
      const createdAt = parseInt(key.slice(prefix.length, prefix.length + 8), 36);
      if (Number.isFinite(createdAt) && createdAt < reportCutoff) await store.delete(key);
    }
  }

  const today = dayStamp();
  const yesterday = dayStamp(new Date(Date.now() - 86_400_000));
  // Counter keys: count/<kind>/<day or window>/...; day-based ones keep today and yesterday.
  const window10 = Math.floor(Date.now() / 600_000);
  const window15 = Math.floor(Date.now() / 900_000);
  for (const key of await store.list("count/")) {
    const parts = key.split("/");
    const kind = parts[1];
    if (kind === "day" || kind === "visitor" || kind === "lead") {
      if (parts[2] !== today && parts[2] !== yesterday) await store.delete(key);
    } else if (kind === "burst" || kind === "leadburst") {
      if (Number(parts[3]) < window10 - 6) await store.delete(key);
    } else if (kind === "admin") {
      if (Number(parts[3]) < window15 - 4) await store.delete(key);
    } else if (kind === "admin-all") {
      if (Number(parts[2]) < window15 - 4) await store.delete(key);
    }
  }

  for (const key of await store.list("url/")) {
    const entry = await store.get<{ createdAt: string }>(key);
    if (!entry || Date.parse(entry.data.createdAt) < Date.now() - 8 * 86_400_000) await store.delete(key);
  }
};

export default cleanup;

export const config = { schedule: "@daily" };
