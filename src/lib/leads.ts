/**
 * Public-mode opt-ins. Each lead is its own entry (`lead/<id>`) so a reused
 * report still records every person who asked for it. Stored so the owner can
 * see leads in /admin even when the CRM webhook is down; deleted by cleanup
 * after keepReportsDays like reports.
 */
import { kv } from "./store";
import { newReportId } from "./secrets";

export interface LeadRecord {
  id: string;
  firstName: string;
  email: string;
  reportId: string;
  sourceUrl: string;
  createdAt: string;
  webhook: "sent" | "failed" | "none";
}

export async function saveLead(lead: Omit<LeadRecord, "id" | "createdAt" | "webhook">): Promise<LeadRecord> {
  const record: LeadRecord = { ...lead, id: newReportId(), createdAt: new Date().toISOString(), webhook: "none" };
  await kv().set(`lead/${record.id}`, record);
  return record;
}

export async function markLead(record: LeadRecord, webhook: LeadRecord["webhook"]): Promise<void> {
  await kv().set(`lead/${record.id}`, { ...record, webhook });
}

export async function listLeads(limit = 200): Promise<LeadRecord[]> {
  const keys = (await kv().list("lead/")).sort().reverse().slice(0, limit);
  const entries = await Promise.all(keys.map((key) => kv().get<LeadRecord>(key)));
  return entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).map((entry) => entry.data);
}
