/**
 * The report record and its lifecycle: create, run (read the source, write
 * with Claude, save), read back. A record is one JSON entry in the store at
 * `report/<id>`. The link `/r/<id>/<key>` is the only way to open it.
 */
import { createHash } from "node:crypto";
import { AiError, writeReport, type WrittenReport } from "./ai";
import { kv, mutate } from "./store";
import type { Settings, SourceType } from "./settings";
import { loadSettings } from "./settings-store";
import { apifyCost, SourceError } from "./sources/apify";
import { gatherEvidence, type EvidenceHints } from "./sources";
import { newReportId, newReportKey, safeEqual } from "./secrets";

export type ReportMode = "live" | "public" | "prefilled" | "sent";
export type ReportStatus = "queued" | "processing" | "complete" | "failed";

export interface ReportRecord {
  id: string;
  key: string;
  mode: ReportMode;
  status: ReportStatus;
  phase: "queued" | "reading" | "writing" | "done";
  source: SourceType;
  url: string;
  notes: string[];
  /** Website / YouTube the owner supplied so the engine needn't find them (optional, older records lack it). */
  hints?: EvidenceHints;
  createdAt: string;
  updatedAt: string;
  leaseUntil: number | null;
  leaseToken: string | null;
  attempts: number;
  errorCode: string | null;
  result: (Omit<WrittenReport, "usage" | "model"> & { subjectName: string | null; thin: boolean }) | null;
  costs: { apifyUsd: number | null; aiUsd: number | null; model: string | null; seconds: number | null } | null;
  ctaClickedAt: string | null;
  viewedAt: string | null;
}

const LEASE_MS = 10 * 60 * 1000;
/** A processing record older than this lost its worker. */
export const STALE_MS = 8 * 60 * 1000;

const reportKey = (id: string) => `report/${id}`;
const ID = /^[a-z0-9]{12,24}$/;

export async function createReport(input: {
  mode: ReportMode;
  source: SourceType;
  url: string;
  notes?: string[];
  hints?: EvidenceHints;
}): Promise<ReportRecord> {
  const now = new Date().toISOString();
  const record: ReportRecord = {
    id: newReportId(),
    key: newReportKey(),
    mode: input.mode,
    status: "queued",
    phase: "queued",
    source: input.source,
    url: input.url,
    notes: input.notes ?? [],
    ...(input.hints && (input.hints.website || input.hints.youtube) ? { hints: input.hints } : {}),
    createdAt: now,
    updatedAt: now,
    leaseUntil: null,
    leaseToken: null,
    attempts: 0,
    errorCode: null,
    result: null,
    costs: null,
    ctaClickedAt: null,
    viewedAt: null,
  };
  await kv().set(reportKey(record.id), record, { onlyIfNew: true });
  return record;
}

export async function getReport(id: string): Promise<ReportRecord | null> {
  if (!ID.test(id)) return null;
  const entry = await kv().get<ReportRecord>(reportKey(id));
  return entry ? entry.data : null;
}

/** Looks a report up by its link. Returns null for a wrong key or an expired report. */
export async function getReportByLink(id: string, key: string, keepDays: number): Promise<ReportRecord | null> {
  const record = await getReport(id);
  if (!record || !safeEqual(record.key, key)) return null;
  if (Date.now() - Date.parse(record.createdAt) > keepDays * 86_400_000) return null;
  return record;
}

export async function updateReport(id: string, fn: (record: ReportRecord) => ReportRecord | undefined): Promise<ReportRecord | null> {
  return mutate<ReportRecord>(reportKey(id), (current) => (current ? fn(current) : undefined));
}

export async function deleteReport(id: string): Promise<void> {
  if (ID.test(id)) await kv().delete(reportKey(id));
}

export async function listReports(limit = 100): Promise<ReportRecord[]> {
  const keys = (await kv().list("report/")).sort().reverse().slice(0, limit);
  const records = await Promise.all(keys.map((key) => kv().get<ReportRecord>(key)));
  return records.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).map((entry) => entry.data);
}

export function reportPath(record: Pick<ReportRecord, "id" | "key">): string {
  return `/r/${record.id}/${record.key}`;
}

/** Marks a processing record whose worker died as failed, so pages stop waiting. */
export async function expireIfStale(record: ReportRecord): Promise<ReportRecord> {
  const inFlight = record.status === "processing" || record.status === "queued";
  if (!inFlight || Date.now() - Date.parse(record.updatedAt) < STALE_MS) return record;
  return (
    (await updateReport(record.id, (current) =>
      current.status === "processing" || current.status === "queued" ? { ...current, status: "failed", errorCode: "timeout", updatedAt: new Date().toISOString() } : undefined,
    )) ?? record
  );
}

/** Same public URL asked for again within a week: reuse the report instead of paying twice. */
export async function findReusable(source: SourceType, url: string, settingsSavedAt: string): Promise<ReportRecord | null> {
  const pointer = await kv().get<{ id: string }>(`url/${urlHash(source, url, settingsSavedAt)}`);
  if (!pointer) return null;
  const record = await getReport(pointer.data.id);
  if (!record || record.mode === "sent" || record.notes.length > 0 || record.status === "failed") return null;
  if (Date.now() - Date.parse(record.createdAt) > 7 * 86_400_000) return null;
  return record;
}

export async function rememberUrl(record: ReportRecord, settingsSavedAt: string): Promise<void> {
  await kv().set(`url/${urlHash(record.source, record.url, settingsSavedAt)}`, { id: record.id, createdAt: record.createdAt });
}

function urlHash(source: string, url: string, settingsSavedAt: string): string {
  return createHash("sha256").update(`${source}|${url.toLowerCase()}|${settingsSavedAt}`).digest("hex").slice(0, 40);
}

function errorCodeFor(err: unknown): string {
  if (err instanceof SourceError || err instanceof AiError) return err.code;
  return "unexpected";
}

/**
 * Builds one report. Safe to call twice: a lease stops two workers from
 * spending credits on the same record, and finished records are left alone.
 */
export async function runReport(id: string, settingsOverride?: Settings): Promise<void> {
  const started = Date.now();
  const token = newReportKey();
  const claimed = await updateReport(id, (record) => {
    if (record.status === "complete" || record.status === "failed") return undefined;
    if (record.leaseUntil && record.leaseUntil > Date.now()) return undefined;
    return { ...record, status: "processing", phase: "reading", leaseUntil: Date.now() + LEASE_MS, leaseToken: token, attempts: record.attempts + 1, updatedAt: new Date().toISOString() };
  });
  if (!claimed || claimed.leaseToken !== token) return;
  if (claimed.attempts > 2) {
    await updateReport(id, (record) => ({ ...record, status: "failed", errorCode: "too_many_attempts", leaseUntil: null, updatedAt: new Date().toISOString() }));
    return;
  }

  let runIds: string[] = [];
  try {
    const settings = settingsOverride ?? (await loadSettings())?.settings;
    if (!settings) throw new SourceError("not_configured");
    if (settings.source.type !== claimed.source) throw new SourceError("source_changed");

    const evidence = await gatherEvidence(settings, claimed.url, claimed.hints ?? {});
    runIds = evidence.apifyRunIds;
    if (evidence.strength === "none" && claimed.notes.length === 0) throw new SourceError("nothing_public");

    await updateReport(id, (record) => ({ ...record, phase: "writing", updatedAt: new Date().toISOString() }));
    const written = await writeReport(settings, evidence, claimed.notes);
    if (written.sections.length === 0) throw new AiError("ai_empty");
    const apifyUsd = await apifyCost(runIds);

    await updateReport(id, (record) => ({
      ...record,
      status: "complete",
      phase: "done",
      leaseUntil: null,
      errorCode: null,
      updatedAt: new Date().toISOString(),
      result: {
        readerName: written.readerName,
        opening: written.opening,
        sections: written.sections,
        subjectName: evidence.subject.name ?? evidence.subject.handle,
        thin: evidence.strength !== "rich",
      },
      costs: { apifyUsd, aiUsd: written.usage.costUsd, model: written.model, seconds: Math.round((Date.now() - started) / 1000) },
    }));
  } catch (err) {
    const code = errorCodeFor(err);
    // Log the code only. Never the URL, notes, lead, or any key.
    console.error(`report ${id} failed: ${code}`);
    const apifyUsd = runIds.length ? await apifyCost(runIds) : 0;
    await updateReport(id, (record) => ({
      ...record,
      status: "failed",
      errorCode: code,
      leaseUntil: null,
      updatedAt: new Date().toISOString(),
      costs: { apifyUsd, aiUsd: null, model: null, seconds: Math.round((Date.now() - started) / 1000) },
    }));
  }
}

/** Messages the prospect sees. Owner-facing detail goes to the admin list. */
export function publicErrorMessage(code: string | null): string {
  switch (code) {
    case "private_account":
      return "That account is private, so there's nothing public to look at. Try a public profile.";
    case "not_found":
    case "nothing_public":
      return "We couldn't find enough public information at that link. Check the link and try again.";
    case "timeout":
      return "This one took too long. Please try again in a minute.";
    default:
      return "Something went wrong while building this report. Please try again in a few minutes.";
  }
}

export function ownerErrorMessage(code: string | null): string {
  const messages: Record<string, string> = {
    apify_missing_token: "APIFY_TOKEN isn't set on this site. Add it in Netlify > Site configuration > Environment variables, then redeploy.",
    apify_bad_token: "Apify rejected the APIFY_TOKEN. Copy a fresh token from Apify and update it in Netlify.",
    apify_out_of_credit: "Your Apify account is out of credit for this month.",
    apify_timeout: "Apify took too long. Try rebuilding.",
    ai_missing_key: "ANTHROPIC_API_KEY isn't set on this site.",
    ai_bad_key: "Anthropic rejected the ANTHROPIC_API_KEY. Check it in Netlify.",
    ai_out_of_credit: "Your Anthropic account is out of credit. Add credit at console.anthropic.com.",
    ai_refusal: "Claude declined to write this one. Try a different prospect.",
    not_configured: "No settings saved yet.",
    source_changed: "Your settings now read a different source than this link. Build a new report.",
    private_account: "The account is private.",
    not_found: "Nothing was found at that link.",
    nothing_public: "There was nothing public to read at that link.",
    timeout: "The build timed out. Try rebuilding.",
    too_many_attempts: "The build failed twice. Try rebuilding later.",
  };
  return (code && messages[code]) || `Build failed (${code ?? "unknown"}). Try rebuilding.`;
}
