import { kv } from "./store";
import { parseSettings, type Settings } from "./settings";

const KEY = "settings/current";
// Short: the admin API and the pages run as separate instances, so a save
// only clears the cache in one of them. 2 seconds keeps "Save and go live" instant.
const CACHE_MS = 2_000;

interface SavedSettings {
  raw: string;
  savedAt: string;
}

let cache: { at: number; value: { settings: Settings; raw: string; savedAt: string } | null } | null = null;

/** The live settings, or null when the owner hasn't saved any yet. */
export async function loadSettings(): Promise<{ settings: Settings; raw: string; savedAt: string } | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const entry = await kv().get<SavedSettings>(KEY);
  let value: { settings: Settings; raw: string; savedAt: string } | null = null;
  if (entry) {
    // Saved text was valid when saved; re-parse so defaults added in a newer
    // engine version apply without the owner pasting again.
    const parsed = parseSettings(entry.data.raw);
    if (parsed.ok) value = { settings: parsed.settings, raw: entry.data.raw, savedAt: entry.data.savedAt };
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(raw: string): Promise<void> {
  await kv().set(KEY, { raw, savedAt: new Date().toISOString() } satisfies SavedSettings);
  cache = null;
}
