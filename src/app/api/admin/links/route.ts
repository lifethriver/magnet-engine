import { adminGuard } from "@/lib/admin-guard";
import { linkSignature } from "@/lib/secrets";
import { loadSettings } from "@/lib/settings-store";
import { normalizeSourceUrl } from "@/lib/source-urls";
import { requestOrigin } from "@/lib/trigger";

export const runtime = "nodejs";

/**
 * Pre-filled links for people the owner is already talking to. Each carries a
 * signature, so the opt-in step is skipped for that link only. Nothing is
 * built (and nothing is spent) until the prospect opens it and clicks.
 */
export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const loaded = await loadSettings();
  if (!loaded) return Response.json({ error: "Save your settings first." }, { status: 409 });
  const body = (await request.json().catch(() => ({}))) as { links?: unknown };
  const inputs = (Array.isArray(body.links) ? body.links : []).filter((l): l is string => typeof l === "string").map((l) => l.trim()).filter(Boolean).slice(0, 100);
  const origin = requestOrigin(request);
  const results = await Promise.all(
    inputs.map(async (input) => {
      let url: string;
      try {
        url = normalizeSourceUrl(loaded.settings.source.type, input);
      } catch (err) {
        return { input, error: err instanceof Error ? err.message : "Check this link." };
      }
      const params = new URLSearchParams({ url, sig: await linkSignature(url) });
      return { input, link: `${origin}/?${params.toString()}` };
    }),
  );
  return Response.json({ results });
}
