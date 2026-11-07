/**
 * Sends a public-mode opt-in to the owner's CRM webhook (GHL inbound
 * webhook, Zapier, Make, Kit or Beehiiv automations). Plain JSON POST, no
 * key. The webhook URL is owner-supplied, so it goes through safeFetch too.
 */
import { safeFetch } from "./safe-fetch";

export interface LeadPayload {
  firstName: string;
  email: string;
  magnet: string;
  sourceUrl: string;
  reportUrl: string;
  createdAt: string;
}

export async function sendLead(webhookUrl: string, payload: LeadPayload): Promise<boolean> {
  try {
    const res = await safeFetch(webhookUrl, {
      method: "POST",
      body: JSON.stringify({ ...payload, first_name: payload.firstName, source: "magnet-engine" }),
      headers: { "content-type": "application/json", accept: "application/json, */*" },
      timeoutMs: 8000,
      maxBytes: 10_000,
      maxRedirects: 2,
    });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;

export function cleanLead(input: { firstName?: unknown; email?: unknown }): { firstName: string; email: string } | null {
  const firstName = typeof input.firstName === "string" ? input.firstName.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 50) : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 254) : "";
  if (!firstName || !EMAIL.test(email)) return null;
  return { firstName, email };
}
