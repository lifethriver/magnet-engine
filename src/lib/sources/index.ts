import type { Settings } from "../settings";
import { normalizeWebsite } from "../source-urls";
import { readInstagram } from "./instagram";
import { readLinkedIn } from "./linkedin";
import type { Evidence } from "./types";
import { gradeStrength } from "./types";
import { readWebsite } from "./website";
import { readYouTube } from "./youtube";

export async function gatherEvidence(settings: Settings, url: string): Promise<Evidence> {
  const { type, alsoReadWebsite, linkedinPosts } = settings.source;
  const evidence =
    type === "website"
      ? await readWebsite(url)
      : type === "linkedin"
        ? await readLinkedIn(url, linkedinPosts)
        : type === "youtube"
          ? await readYouTube(url)
          : await readInstagram(url);

  // A profile that links its own site gets the site read too (free, plain fetch).
  if (type !== "website" && alsoReadWebsite && evidence.linkedWebsite) {
    let site: string | null = null;
    try {
      site = normalizeWebsite(evidence.linkedWebsite);
    } catch {
      site = null;
    }
    if (site) {
      const extra = await readWebsite(site);
      if (extra.blocks.length) {
        evidence.facts.push(...extra.facts.map((fact) => `Their website: ${fact}`));
        evidence.blocks.push(...extra.blocks.slice(0, 3).map((block) => ({ label: `Their website, ${block.label}`, text: block.text.slice(0, 3000) })));
      }
    }
  }
  evidence.strength = gradeStrength(evidence);
  return evidence;
}

export function evidenceForPrompt(evidence: Evidence): string {
  return [
    `Source: ${evidence.source} (${evidence.url})`,
    ...evidence.facts.map((fact) => `- ${fact}`),
    "",
    ...evidence.blocks.map((block) => `### ${block.label}\n${block.text}`),
  ].join("\n");
}
