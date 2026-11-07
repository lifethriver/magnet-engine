import { adminGuard } from "@/lib/admin-guard";
import { reportsToday } from "@/lib/limits";
import { loadSettings } from "@/lib/settings-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const loaded = await loadSettings();
  return Response.json({
    ok: true,
    configured: Boolean(loaded),
    name: loaded?.settings.name ?? null,
    source: loaded?.settings.source.type ?? null,
    optIn: loaded?.settings.publicMode.optIn ?? false,
    dailyCap: loaded?.settings.limits.dailyReports ?? null,
    today: await reportsToday(),
    keys: { anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()), apify: Boolean(process.env.APIFY_TOKEN?.trim()) },
  });
}
