import type { Settings } from "../settings";
import { normalizeInstagram, normalizeWebsite, normalizeYouTube } from "../source-urls";
import { readInstagram } from "./instagram";
import { readLinkedIn } from "./linkedin";
import type { Evidence } from "./types";
import { gradeStrength } from "./types";
import { readWebsite } from "./website";
import { readYouTube } from "./youtube";

/** Things the owner already knows about the prospect, so the engine doesn't have to find them. */
export interface EvidenceHints {
  website?: string | null;
  youtube?: string | null;
}

function tryNormalize(fn: (raw: string) => string, raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return fn(raw);
  } catch {
    return null;
  }
}

function pick(channels: string[], test: RegExp): string | null {
  return channels.find((c) => test.test(c)) ?? null;
}

/**
 * Reads the main source, then follows what it links to: the website (free),
 * a YouTube channel (free) and a public Instagram profile (under a cent), and
 * names any other channels it saw. The picture of what the prospect already
 * has online is what makes a report specific instead of generic.
 */
export async function gatherEvidence(settings: Settings, url: string, hints: EvidenceHints = {}): Promise<Evidence> {
  const { type, alsoReadWebsite, linkedinPosts } = settings.source;
  const evidence =
    type === "website"
      ? await readWebsite(url)
      : type === "linkedin"
        ? await readLinkedIn(url, linkedinPosts)
        : type === "youtube"
          ? await readYouTube(url)
          : await readInstagram(url);

  const channels = new Set<string>(evidence.linkedChannels);

  // 1. The website: the one the owner typed, else the one the profile links. Free, plain fetch.
  const site = type === "website" ? null : tryNormalize(normalizeWebsite, hints.website) ?? (alsoReadWebsite ? tryNormalize(normalizeWebsite, evidence.linkedWebsite) : null);
  if (site) {
    try {
      const extra = await readWebsite(site);
      if (extra.blocks.length) {
        evidence.facts.push(...extra.facts.map((fact) => `Their website: ${fact}`));
        evidence.blocks.push(...extra.blocks.slice(0, 3).map((block) => ({ label: `Their website, ${block.label}`, text: block.text.slice(0, 3000) })));
        evidence.linkedWebsite = site;
        extra.linkedChannels.forEach((c) => channels.add(c));
      }
    } catch {
      // A site that won't load is not a reason to fail the report.
    }
  }

  // 2. A YouTube channel: typed, or linked from the profile or site. Free.
  const youtube = type === "youtube" ? null : tryNormalize(normalizeYouTube, hints.youtube) ?? tryNormalize(normalizeYouTube, pick([...channels], /youtube\.com\//i));
  if (youtube) {
    try {
      const yt = await readYouTube(youtube);
      if (yt.facts.length) {
        evidence.facts.push(...yt.facts.map((fact) => `Their YouTube channel: ${fact}`));
        evidence.blocks.push(...yt.blocks.slice(0, 2).map((block) => ({ label: `Their YouTube channel, ${block.label}`, text: block.text.slice(0, 3000) })));
      }
    } catch {
      // Unreadable channel: the report simply says nothing about YouTube.
    }
  }

  // 3. A public Instagram profile linked from the profile or site. Apify, under a cent; private accounts come back empty.
  const instagram = type === "instagram" ? null : tryNormalize(normalizeInstagram, pick([...channels], /instagram\.com\//i));
  if (instagram) {
    try {
      const ig = await readInstagram(instagram);
      evidence.apifyRunIds.push(...ig.apifyRunIds);
      if (ig.facts.length) {
        evidence.facts.push(...ig.facts.map((fact) => `Their Instagram: ${fact}`));
        evidence.blocks.push(...ig.blocks.slice(0, 1).map((block) => ({ label: `Their Instagram, ${block.label}`, text: block.text.slice(0, 2000) })));
      }
    } catch {
      // Same rule: a channel that can't be read is left out, never guessed at.
    }
  }

  // 4. Anything else they link (Facebook, TikTok, X, a LinkedIn company page): named, not read.
  const others = [...channels].filter((c) => !/youtube\.com|instagram\.com/i.test(c) && c.toLowerCase() !== url.toLowerCase()).slice(0, 6);
  if (others.length) evidence.facts.push(`Other public profiles they link to: ${others.join(", ")}`);
  evidence.linkedChannels = [...channels];

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
