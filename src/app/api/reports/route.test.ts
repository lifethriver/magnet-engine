import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Collect next/after work instead of needing a real request scope.
const pending: (() => Promise<unknown> | unknown)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => unknown) => pending.push(fn) }));
// Never start a real build (no Apify or Claude calls in tests).
const started: string[] = [];
vi.mock("@/lib/trigger", () => ({
  startReport: async (id: string) => void started.push(id),
  requestOrigin: () => "https://magnet.example",
}));

beforeAll(() => {
  process.env.MAGNET_DATA_DIR = mkdtempSync(path.join(tmpdir(), "magnet-route-"));
});

function post(body: Record<string, unknown>, ip = "203.0.113.50") {
  return new Request("https://magnet.example/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json", "x-nf-client-connection-ip": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reports", () => {
  it("rate-limits opt-ins on reused reports before saving or sending the lead", async () => {
    const { saveSettings, loadSettings } = await import("@/lib/settings-store");
    const { createReport, rememberUrl } = await import("@/lib/reports");
    const { kv } = await import("@/lib/store");
    const { POST } = await import("./route");

    // Example 1 has public mode (opt-in) on.
    await saveSettings(readFileSync(path.join(__dirname, "../../../../examples/channel-money-map.yaml"), "utf8"));
    const loaded = await loadSettings();
    if (!loaded) throw new Error("settings should load");
    const url = "https://www.youtube.com/@reused";
    const record = await createReport({ mode: "public", source: "youtube", url });
    await rememberUrl(record, loaded.savedAt);

    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await POST(post({ url, firstName: "Fake", email: `fake${i}@example.com` }));
      statuses.push(res.status);
    }
    // The first 3 in a 10-minute window get the reused report; the rest are refused.
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses.slice(3).every((status) => status === 429)).toBe(true);

    for (const fn of pending.splice(0)) await fn();
    expect(await kv().list("lead/")).toHaveLength(3);
    expect(started).toHaveLength(0);
  });

  it("still asks for name and email in public mode", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ url: "youtube.com/@someone" }, "198.51.100.7"));
    expect(res.status).toBe(400);
  });
});
