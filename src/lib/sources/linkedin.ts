/**
 * Reads a public LinkedIn profile through two HarvestAPI actors on Apify
 * (both "no cookies", pay per result), the same pair the Shortlist uses:
 *   harvestapi~linkedin-profile-scraper   $0.004 per profile
 *   harvestapi~linkedin-profile-posts     $0.002 per post returned
 * Inputs follow each actor's published schema. Output field names vary
 * between actor versions, so the readers look at several candidates.
 */
import { runActor, SourceError } from "./apify";
import { emptyEvidence, gradeStrength, obj, shortDate, str, type Evidence } from "./types";

const PROFILE_ACTOR = "harvestapi~linkedin-profile-scraper";
const POSTS_ACTOR = "harvestapi~linkedin-profile-posts";
// The actor's validator accepts this exact label (checked by the Shortlist, 2026-11-03).
const PROFILE_MODE = "Profile details no email ($4 per 1k)";

type Loose = Record<string, unknown>;

function roleLine(entry: Loose): string | null {
  const title = str(entry.position) ?? str(entry.title) ?? str(entry.jobTitle);
  const company = str(entry.companyName) ?? str(obj(entry.company)?.name) ?? (typeof entry.company === "string" ? str(entry.company) : null);
  const duration = str(entry.duration) ?? str(obj(entry.dateRange)?.text) ?? null;
  if (!title && !company) return null;
  return [title, company].filter(Boolean).join(" at ") + (duration ? ` (${duration})` : "");
}

function list(value: unknown): Loose[] {
  return Array.isArray(value) ? value.map(obj).filter((v): v is Loose => Boolean(v)) : [];
}

const SOCIAL_HOST = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com)$/i;
const SKIP_LINK = /linkedin\.com\/(in|posts|feed|pulse)|calendar\.app\.google|calendly\.com|linktr\.ee|beacons\.ai|stan\.store|bit\.ly|lnkd\.in/i;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Pure: every http(s) link found anywhere on a profile object, deduplicated, shorteners and booking pages dropped. Exported for tests. */
export function profileLinks(p: Record<string, unknown>): { website: string | null; channels: string[] } {
  const found: string[] = [];
  const push = (u: unknown) => {
    const v = str(u);
    if (v && /^https?:\/\//i.test(v) && !SKIP_LINK.test(v) && hostOf(v)) found.push(v.replace(/[),.;]+$/, ""));
  };
  list(p.profileActions).forEach((a) => push(a.url));
  list(p.websites).forEach((w) => push(w.url ?? w.link ?? w));
  (Array.isArray(p.websites) ? p.websites : []).forEach((w) => push(w));
  const contact = obj(p.contactInfo) ?? obj(p.contact);
  if (contact) {
    list(contact.websites).forEach((w) => push(w.url ?? w));
    (Array.isArray(contact.websites) ? contact.websites : []).forEach((w) => push(w));
    push(contact.twitter);
  }
  const fobj = obj(p.featured);
  const featuredRaw: unknown[] = Array.isArray(p.featured) ? p.featured : fobj ? [...(Array.isArray(fobj.items) ? fobj.items : []), ...(Array.isArray(fobj.slides) ? fobj.slides : [])] : [];
  featuredRaw.forEach((f) => push(obj(f)?.url ?? obj(f)?.link));
  const about = str(p.about) ?? str(p.summary) ?? "";
  for (const m of about.matchAll(/https?:\/\/[^\s<>"')\]]+/g)) push(m[0]);
  const seen = new Set<string>();
  const unique = found.filter((u) => {
    const k = u.toLowerCase().replace(/\/$/, "");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const channels = unique.filter((u) => SOCIAL_HOST.test(hostOf(u) ?? "")).slice(0, 8);
  const website = unique.find((u) => !SOCIAL_HOST.test(hostOf(u) ?? "")) ?? null;
  return { website, channels };
}

export function summarizeProfile(raw: unknown): { name: string | null; headline: string | null; facts: string[]; blocks: Evidence["blocks"]; website: string | null; channels: string[] } {
  const p = obj(raw);
  if (!p) return { name: null, headline: null, facts: [], blocks: [], website: null, channels: [] };
  const first = str(p.firstName);
  const last = str(p.lastName);
  const name = str(p.name) ?? str(p.fullName) ?? (first || last ? [first, last].filter(Boolean).join(" ") : null);
  const headline = str(p.headline) ?? str(p.occupation);
  const location = str(obj(p.location)?.linkedinText) ?? str(obj(obj(p.location)?.parsed)?.text) ?? (typeof p.location === "string" ? str(p.location) : null);
  const current = Array.isArray(p.currentPosition) ? list(p.currentPosition) : obj(p.currentPosition) ? [obj(p.currentPosition) as Loose] : [];
  const experience = list(p.experience).map(roleLine).filter((x): x is string => Boolean(x)).slice(0, 8);
  const education = list(p.education)
    .map((e) => [str(e.schoolName) ?? str(e.school), str(e.degree) ?? str(e.degreeName), str(e.fieldOfStudy)].filter(Boolean).join(", "))
    .filter(Boolean)
    .slice(0, 3);
  const skills = list(p.skills).map((s) => str(s.name) ?? str(s.title)).filter(Boolean).slice(0, 15) as string[];
  const fobj = obj(p.featured);
  const featuredRaw: unknown[] = Array.isArray(p.featured) ? p.featured : fobj ? [...(Array.isArray(fobj.items) ? fobj.items : []), ...(Array.isArray(fobj.slides) ? fobj.slides : [])] : [];
  const featured = featuredRaw
    .map((f) => (typeof f === "string" ? str(f) : obj(f) ? str(obj(f)?.title) ?? str(obj(f)?.text) : null))
    .filter(Boolean)
    .slice(0, 6) as string[];
  const { website, channels } = profileLinks(p);

  const facts: string[] = [];
  if (name) facts.push(`Name: ${name}`);
  if (headline) facts.push(`Headline: ${headline}`);
  if (location) facts.push(`Location: ${location}`);
  if (current.length) {
    const role = roleLine(current[0]);
    if (role) facts.push(`Current role: ${role}`);
  }
  const followers = typeof p.followerCount === "number" ? p.followerCount : typeof p.followersCount === "number" ? p.followersCount : null;
  if (followers !== null) facts.push(`LinkedIn followers: ${followers.toLocaleString("en-US")}`);
  if (typeof p.connectionsCount === "number") facts.push(`LinkedIn connections: ${p.connectionsCount.toLocaleString("en-US")}`);
  if (featured.length) facts.push(`Featured on profile: ${featured.map((f) => `"${f}"`).join("; ")}`);
  if (website) facts.push(`Website on profile: ${website}`);
  if (channels.length) facts.push(`Other channels linked from the profile: ${channels.join(", ")}`);

  const blocks: Evidence["blocks"] = [];
  const about = str(p.about) ?? str(p.summary);
  if (about) blocks.push({ label: "About section", text: about.slice(0, 2500) });
  if (experience.length) blocks.push({ label: "Experience, most recent first", text: experience.map((e) => `- ${e}`).join("\n") });
  if (education.length) blocks.push({ label: "Education", text: education.map((e) => `- ${e}`).join("\n") });
  if (skills.length) blocks.push({ label: "Skills listed", text: skills.join(", ") });
  return { name, headline, facts, blocks, website, channels };
}

export function summarizePosts(items: unknown[]): string[] {
  return items
    .map((raw) => {
      const item = obj(raw);
      if (!item) return null;
      const text = str(item.content) ?? str(item.text) ?? str(item.commentary) ?? "";
      if (!text) return null;
      const posted = obj(item.postedAt);
      const date = str(posted?.date) ?? str(item.postedAt) ?? str(item.publishedAt) ?? null;
      const reposted = Boolean(item.repostedBy) || /repost/i.test(String(item.type ?? ""));
      const reactions = obj(item.engagement)?.likes ?? item.numLikes ?? item.reactionsCount;
      return `- ${shortDate(date) ?? "undated"}${reposted ? " (repost)" : ""}${typeof reactions === "number" ? `, ${reactions} reactions` : ""}: ${text.replace(/\s+/g, " ").slice(0, 700)}`;
    })
    .filter((line): line is string => Boolean(line));
}

export async function readLinkedIn(profileUrl: string, maxPosts: number): Promise<Evidence> {
  const evidence = emptyEvidence("linkedin", profileUrl);
  const [profile, posts] = await Promise.allSettled([
    runActor(PROFILE_ACTOR, { urls: [profileUrl], profileScraperMode: PROFILE_MODE }),
    maxPosts > 0 ? runActor(POSTS_ACTOR, { targetUrls: [profileUrl], maxPosts, includeQuotePosts: true, includeReposts: false }) : Promise.resolve(null),
  ]);

  if (profile.status === "rejected" && profile.reason instanceof SourceError && /token|credit/.test(profile.reason.code)) {
    throw profile.reason;
  }
  if (profile.status === "fulfilled") {
    evidence.apifyRunIds.push(profile.value.runId);
    const summary = summarizeProfile(profile.value.items[0]);
    evidence.subject.name = summary.name;
    evidence.facts.push(...summary.facts);
    evidence.blocks.push(...summary.blocks);
    evidence.linkedWebsite = summary.website;
    evidence.linkedChannels = summary.channels;
  }
  if (posts.status === "fulfilled" && posts.value) {
    evidence.apifyRunIds.push(posts.value.runId);
    const lines = summarizePosts(posts.value.items);
    evidence.facts.push(`Recent public posts found: ${lines.length}`);
    if (lines.length) evidence.blocks.push({ label: "Recent LinkedIn posts, newest first", text: lines.join("\n") });
  }
  evidence.strength = gradeStrength(evidence);
  return evidence;
}
