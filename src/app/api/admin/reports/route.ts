import { adminGuard } from "@/lib/admin-guard";
import { createReport, expireIfStale, listReports, ownerErrorMessage, reportPath } from "@/lib/reports";
import { loadSettings } from "@/lib/settings-store";
import { normalizeSourceUrl, normalizeWebsite, normalizeYouTube } from "@/lib/source-urls";
import { requestOrigin, startReport } from "@/lib/trigger";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_LINKS = 10;
const MAX_NOTES = 3;
const MAX_NOTE_CHARS = 500;

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const origin = requestOrigin(request);
  const records = await Promise.all((await listReports(100)).map(expireIfStale));
  return Response.json({
    reports: records.map((r) => ({
      id: r.id,
      link: `${origin}${reportPath(r)}`,
      mode: r.mode,
      status: r.status,
      phase: r.phase,
      source: r.source,
      url: r.url,
      name: r.result?.subjectName ?? null,
      notes: r.notes.length,
      createdAt: r.createdAt,
      viewedAt: r.viewedAt,
      ctaClickedAt: r.ctaClickedAt,
      error: r.status === "failed" ? ownerErrorMessage(r.errorCode) : null,
      costs: r.costs,
    })),
  });
}

/**
 * Pre-built ("sent") reports: { links: string[], notes?: string[] }. Notes are
 * a prospect's own answers from a real conversation, so they only apply when
 * one link is built at a time.
 */
export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const loaded = await loadSettings();
  if (!loaded) return Response.json({ error: "Save your settings first." }, { status: 409 });
  const { settings } = loaded;

  const body = (await request.json().catch(() => ({}))) as { links?: unknown; notes?: unknown; website?: unknown; youtube?: unknown };
  const links = (Array.isArray(body.links) ? body.links : [])
    .filter((link): link is string => typeof link === "string")
    .map((link) => link.trim())
    .filter(Boolean);
  const notes = (Array.isArray(body.notes) ? body.notes : [])
    .filter((note): note is string => typeof note === "string")
    .map((note) => note.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, MAX_NOTE_CHARS))
    .filter(Boolean);

  if (links.length === 0) return Response.json({ error: "Paste at least one link." }, { status: 400 });
  if (links.length > MAX_LINKS) return Response.json({ error: `Build up to ${MAX_LINKS} at a time.` }, { status: 400 });
  if (notes.length > MAX_NOTES) return Response.json({ error: `Add up to ${MAX_NOTES} notes.` }, { status: 400 });
  if (notes.length > 0 && links.length > 1) {
    return Response.json({ error: "Conversation notes belong to one person, so build one link at a time when you add notes." }, { status: 400 });
  }
  // Optional help for one prospect: their website and YouTube channel, when the profile doesn't link them.
  const hints: { website?: string; youtube?: string } = {};
  const websiteHint = typeof body.website === "string" ? body.website.trim() : "";
  const youtubeHint = typeof body.youtube === "string" ? body.youtube.trim() : "";
  if ((websiteHint || youtubeHint) && links.length > 1) {
    return Response.json({ error: "A website or YouTube channel belongs to one person, so build one link at a time when you add them." }, { status: 400 });
  }
  try {
    if (websiteHint) hints.website = normalizeWebsite(websiteHint);
    if (youtubeHint) hints.youtube = normalizeYouTube(youtubeHint);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Check the website or YouTube link." }, { status: 400 });
  }

  const origin = requestOrigin(request);
  const results: { input: string; link?: string; error?: string }[] = [];
  for (const input of links) {
    let url: string;
    try {
      url = normalizeSourceUrl(settings.source.type, input);
    } catch (err) {
      results.push({ input, error: err instanceof Error ? err.message : "Check this link." });
      continue;
    }
    const record = await createReport({ mode: "sent", source: settings.source.type, url, notes, hints });
    await startReport(record.id, origin);
    results.push({ input, link: `${origin}${reportPath(record)}` });
  }
  return Response.json({ results });
}
