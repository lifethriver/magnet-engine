import { adminGuard } from "@/lib/admin-guard";
import { parseSettings } from "@/lib/settings";
import { loadSettings, saveSettings } from "@/lib/settings-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const loaded = await loadSettings();
  return Response.json({ raw: loaded?.raw ?? "", savedAt: loaded?.savedAt ?? null });
}

/** { text, save } checks the block; with save: true it also goes live. */
export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { text?: unknown; save?: unknown };
  const text = typeof body.text === "string" ? body.text : "";
  const parsed = parseSettings(text);
  if (!parsed.ok) return Response.json({ ok: false, errors: parsed.errors }, { status: 422 });
  const { settings } = parsed;
  if (body.save === true) await saveSettings(text);
  return Response.json({
    ok: true,
    saved: body.save === true,
    warnings: parsed.warnings,
    summary: {
      name: settings.name,
      source: settings.source.type,
      sections: settings.sections.map((s) => s.title),
      cta: `${settings.cta.buttonText} -> ${settings.cta.url}`,
      optIn: settings.publicMode.optIn,
      dailyReports: settings.limits.dailyReports,
    },
  });
}
