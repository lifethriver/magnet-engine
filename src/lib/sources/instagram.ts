/**
 * Reads a public Instagram profile through Apify's own
 * `apify~instagram-profile-scraper` (pay per profile, $0.0026 on the Free
 * plan, checked 2026-11-06). One run returns the bio, counts, link in bio,
 * business category and the 12 latest posts with captions and dates.
 * Private accounts return no posts and fail cleanly.
 */
import { runActor, SourceError } from "./apify";
import { emptyEvidence, gradeStrength, obj, shortDate, str, type Evidence } from "./types";
import { instagramUsername } from "../source-urls";

const ACTOR = "apify~instagram-profile-scraper";

export function summarizeInstagram(raw: unknown): Pick<Evidence, "subject" | "facts" | "blocks" | "linkedWebsite"> & { isPrivate: boolean; found: boolean } {
  const p = obj(raw);
  if (!p || p.error || !str(p.username)) {
    return { subject: { name: null, handle: null }, facts: [], blocks: [], linkedWebsite: null, isPrivate: false, found: false };
  }
  const username = str(p.username) as string;
  const facts: string[] = [`Instagram: @${username}`];
  const fullName = str(p.fullName);
  if (fullName) facts.push(`Display name: ${fullName}`);
  if (typeof p.followersCount === "number") facts.push(`Followers: ${p.followersCount.toLocaleString("en-US")}`);
  if (typeof p.followsCount === "number") facts.push(`Following: ${p.followsCount.toLocaleString("en-US")}`);
  if (typeof p.postsCount === "number") facts.push(`Posts on the profile: ${p.postsCount.toLocaleString("en-US")}`);
  const category = str(p.businessCategoryName);
  if (category && category !== "None") facts.push(`Category: ${category}`);
  if (p.isBusinessAccount === true) facts.push("Business or creator account: yes");
  if (p.verified === true) facts.push("Verified: yes");
  const links = Array.isArray(p.externalUrls)
    ? p.externalUrls.map((u) => str(obj(u)?.url) ?? str(u)).filter(Boolean)
    : [];
  const external = str(p.externalUrl) ?? (links[0] as string | undefined) ?? null;
  if (external) facts.push(`Link in bio: ${external}`);
  if (links.length > 1) facts.push(`Other bio links: ${links.slice(1, 5).join(", ")}`);

  const blocks: Evidence["blocks"] = [];
  const bio = str(p.biography);
  if (bio) blocks.push({ label: "Bio", text: bio });
  const posts = Array.isArray(p.latestPosts) ? p.latestPosts.map(obj).filter(Boolean) : [];
  if (posts.length) {
    blocks.push({
      label: "Latest posts, newest first (date, type, likes, comments, caption)",
      text: posts
        .slice(0, 12)
        .map((post) => {
          const item = post as Record<string, unknown>;
          const parts = [shortDate(str(item.timestamp)), str(item.type), typeof item.likesCount === "number" && item.likesCount >= 0 ? `${item.likesCount} likes` : null, typeof item.commentsCount === "number" ? `${item.commentsCount} comments` : null, item.isPinned ? "pinned" : null].filter(Boolean);
          return `- ${parts.join(", ")}: ${(str(item.caption) ?? "(no caption)").replace(/\s+/g, " ").slice(0, 500)}`;
        })
        .join("\n"),
    });
  }
  const linkedWebsite = external && !/linktr\.ee|beacons\.ai|stan\.store|instagram\.com|facebook\.com|youtube\.com|tiktok\.com|wa\.me|bit\.ly/i.test(external) ? external : null;
  return { subject: { name: fullName, handle: `@${username}` }, facts, blocks, linkedWebsite, isPrivate: p.private === true, found: true };
}

export async function readInstagram(profileUrl: string): Promise<Evidence> {
  const evidence = emptyEvidence("instagram", profileUrl);
  const run = await runActor(ACTOR, { usernames: [instagramUsername(profileUrl)] }, 120_000);
  evidence.apifyRunIds.push(run.runId);
  const summary = summarizeInstagram(run.items[0]);
  if (!summary.found) throw new SourceError("not_found");
  if (summary.isPrivate) throw new SourceError("private_account");
  evidence.subject = summary.subject;
  evidence.facts = summary.facts;
  evidence.blocks = summary.blocks;
  evidence.linkedWebsite = summary.linkedWebsite;
  evidence.strength = gradeStrength(evidence);
  return evidence;
}
