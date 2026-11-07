import { expireIfStale, getReportByLink, publicErrorMessage, updateReport } from "@/lib/reports";
import { loadSettings } from "@/lib/settings-store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; key: string }> };

async function find({ params }: Params) {
  const { id, key } = await params;
  const loaded = await loadSettings();
  const record = await getReportByLink(id, key, loaded?.settings.limits.keepReportsDays ?? 60);
  return record ? expireIfStale(record) : null;
}

/** Polled by the report page while it builds. Says nothing about the content. */
export async function GET(_request: Request, context: Params) {
  const record = await find(context);
  if (!record) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({
    status: record.status,
    phase: record.phase,
    error: record.status === "failed" ? publicErrorMessage(record.errorCode) : null,
  });
}

/** { event: "cta" } records the first click on the call-to-action button. */
export async function POST(request: Request, context: Params) {
  const record = await find(context);
  if (!record) return Response.json({ error: "Not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { event?: string };
  if (body.event === "cta" && !record.ctaClickedAt) {
    await updateReport(record.id, (current) => (current.ctaClickedAt ? undefined : { ...current, ctaClickedAt: new Date().toISOString() }));
  }
  return Response.json({ ok: true });
}
