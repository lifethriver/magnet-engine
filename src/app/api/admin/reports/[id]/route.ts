import { adminGuard } from "@/lib/admin-guard";
import { deleteReport, getReport, updateReport } from "@/lib/reports";
import { requestOrigin, startReport } from "@/lib/trigger";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** { action: "rebuild" } builds the same link again with the current settings. */
export async function POST(request: Request, { params }: Params) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const { id } = await params;
  const record = await getReport(id);
  if (!record) return Response.json({ error: "Not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "rebuild") return Response.json({ error: "Unknown action." }, { status: 400 });
  if (record.status === "processing" && record.leaseUntil && record.leaseUntil > Date.now()) {
    return Response.json({ error: "It's still building." }, { status: 409 });
  }
  await updateReport(id, (current) => ({
    ...current,
    status: "queued",
    phase: "queued",
    attempts: 0,
    leaseUntil: null,
    leaseToken: null,
    errorCode: null,
    updatedAt: new Date().toISOString(),
  }));
  await startReport(id, requestOrigin(request));
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const { id } = await params;
  await deleteReport(id);
  return Response.json({ ok: true });
}
