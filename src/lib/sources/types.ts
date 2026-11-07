import type { SourceType } from "../settings";

/** One labelled piece of public text. Always treated by the AI as untrusted. */
export interface EvidenceBlock {
  label: string;
  text: string;
}

export interface Evidence {
  source: SourceType;
  url: string;
  /** Who the report is about, as the source states it. */
  subject: { name: string | null; handle: string | null };
  /** Short, already-verified facts ("Subscribers: 12.4K"). */
  facts: string[];
  blocks: EvidenceBlock[];
  /** A website found on the profile, read for extra context when enabled. */
  linkedWebsite: string | null;
  apifyRunIds: string[];
  /** How much there was to work with; "none" fails the report before the AI call. */
  strength: "rich" | "thin" | "none";
}

export function emptyEvidence(source: SourceType, url: string): Evidence {
  return { source, url, subject: { name: null, handle: null }, facts: [], blocks: [], linkedWebsite: null, apifyRunIds: [], strength: "none" };
}

export function gradeStrength(evidence: Evidence): Evidence["strength"] {
  const chars = evidence.blocks.reduce((sum, block) => sum + block.text.length, 0);
  if (chars === 0 && evidence.facts.length === 0) return "none";
  if (chars < 800) return "thin";
  return "rich";
}

export const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
export const obj = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

export function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Date(time).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });
}
