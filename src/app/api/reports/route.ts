import { after } from "next/server";
import { cleanLead, sendLead } from "@/lib/crm";
import { markLead, saveLead } from "@/lib/leads";
import { takeDailyAllowance, takeLeadAllowance, takeVisitorAllowance } from "@/lib/limits";
import { createReport, findReusable, rememberUrl, reportPath, type ReportMode } from "@/lib/reports";
import { clientIp, hashIdentity, verifyLinkSignature } from "@/lib/secrets";
import { loadSettings } from "@/lib/settings-store";
import { normalizeSourceUrl } from "@/lib/source-urls";
import { requestOrigin, startReport } from "@/lib/trigger";

export const runtime = "nodejs";
export const maxDuration = 60;

const LIMIT_MESSAGES = {
  daily_cap: "Today's reports are all used up. Please come back tomorrow.",
  visitor_cap: "You've reached today's limit for this connection. Please come back tomorrow.",
  burst: "Give it a few minutes before you start another one.",
} as const;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const loaded = await loadSettings();
  if (!loaded) return Response.json({ error: "This page isn't set up yet." }, { status: 503 });
  const { settings, savedAt } = loaded;

  let url: string;
  try {
    url = normalizeSourceUrl(settings.source.type, typeof body.url === "string" ? body.url : "");
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Check the link and try again." }, { status: 400 });
  }

  const signed = await verifyLinkSignature(url, typeof body.sig === "string" ? body.sig : null);
  const needsOptIn = settings.publicMode.optIn && !signed;
  const lead = needsOptIn ? cleanLead(body) : null;
  if (needsOptIn && !lead) return Response.json({ error: "Enter your first name and a valid email address." }, { status: 400 });

  // Every opt-in is stored and sent to the owner's CRM, even when the report
  // is reused, so it's limited before anything is saved or sent.
  const ipHash = await hashIdentity(clientIp(request));
  if (lead && !(await takeLeadAllowance(ipHash))) {
    return Response.json({ error: LIMIT_MESSAGES.burst }, { status: 429 });
  }

  const origin = requestOrigin(request);
  const recordLead = (reportId: string, path: string) => {
    if (!lead) return;
    after(async () => {
      const saved = await saveLead({ ...lead, reportId, sourceUrl: url });
      const webhook = settings.publicMode.crmWebhookUrl;
      if (!webhook) return;
      const ok = await sendLead(webhook, { ...lead, magnet: settings.name, sourceUrl: url, reportUrl: `${origin}${path}`, createdAt: saved.createdAt });
      await markLead(saved, ok ? "sent" : "failed");
    });
  };

  // Asked for again this week: hand back the same report, at no cost.
  const reusable = await findReusable(settings.source.type, url, savedAt);
  if (reusable) {
    const path = reportPath(reusable);
    recordLead(reusable.id, path);
    return Response.json({ path });
  }

  const visitor = await takeVisitorAllowance(ipHash, settings.limits.perVisitorPerDay);
  if (!visitor.ok) return Response.json({ error: LIMIT_MESSAGES[visitor.reason] }, { status: 429 });
  const daily = await takeDailyAllowance(settings.limits.dailyReports);
  if (!daily.ok) return Response.json({ error: LIMIT_MESSAGES[daily.reason] }, { status: 429 });

  const mode: ReportMode = signed ? "prefilled" : settings.publicMode.optIn ? "public" : "live";
  const record = await createReport({ mode, source: settings.source.type, url });
  await rememberUrl(record, savedAt);
  await startReport(record.id, origin);
  const path = reportPath(record);
  recordLead(record.id, path);
  return Response.json({ path }, { status: 201 });
}
