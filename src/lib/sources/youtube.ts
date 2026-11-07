/**
 * Reads a public YouTube channel with no API key and no cost:
 *   1. the channel's Videos page: name, description, subscriber and video
 *      counts, the channel id, links in the header;
 *   2. the public feed (feeds/videos.xml?channel_id=UC...): the newest 15
 *      videos with exact dates, descriptions and view counts.
 * YouTube's markup is undocumented, so every field is optional and a failure
 * degrades to "not stated" rather than a guess. Ported from the Shortlist.
 */
import { emptyEvidence, gradeStrength, shortDate, type Evidence } from "./types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export interface ChannelPage {
  channelId: string | null;
  name: string | null;
  description: string | null;
  subscribers: string | null;
  videoCount: string | null;
  links: string[];
  recent: { title: string; ago: string | null; views: string | null }[];
}

export interface FeedEntry {
  title: string;
  publishedAt: string;
  description: string;
  views: number | null;
}

function decode(text: string): string {
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

export function parseChannelPage(html: string, url: string): ChannelPage | null {
  const name = html.match(/<title>([^<]*?)\s*-\s*YouTube<\/title>/i)?.[1]?.trim() ?? null;
  // The JSON copy is the full description; the meta tag is cut at about 160 characters.
  const description =
    html.match(/"channelMetadataRenderer":\{"title":"(?:[^"\\]|\\.)*","description":"((?:[^"\\]|\\.){10,5000})"/)?.[1] ??
    html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ??
    null;
  const subscribers = html.match(/"(\d[\d,.]*[KMB]? subscribers?)"/)?.[1] ?? null;
  const counts = [...html.matchAll(/"(\d[\d,.]*[KM]? videos?)"/g)].map((m) => m[1]);
  const videoCount = counts.find((c) => !/^1 video$/.test(c)) ?? counts[0] ?? null;
  const channelId = url.match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/)?.[1] ?? html.match(/"externalId":"(UC[A-Za-z0-9_-]{20,})"/)?.[1] ?? null;
  const links = [
    ...new Set(
      [...html.matchAll(/"url":"https:\/\/www\.youtube\.com\/redirect\?[^"]*?q=([^"&]+)/g)]
        .map((m) => {
          try {
            return decodeURIComponent(decode(m[1]));
          } catch {
            return null;
          }
        })
        .filter((link): link is string => Boolean(link) && /^https?:\/\//.test(link as string)),
    ),
  ].slice(0, 8);
  const recent: ChannelPage["recent"] = [];
  // Seen 2026-11-06: each video is a lockup with accessibility labels "N views" then "N days ago".
  const re = /"lockupMetadataViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)+)"\}[\s\S]{0,800}?"accessibilityLabel":"([\d.,]+(?: thousand| million| billion)?[KMB]? views?|No views)"[\s\S]{0,400}?"accessibilityLabel":"(\d+ (?:second|minute|hour|day|week|month|year)s? ago)"/g;
  for (const m of html.matchAll(re)) {
    recent.push({ title: decode(m[1]), views: m[2], ago: m[3] });
    if (recent.length >= 15) break;
  }
  if (!name && !channelId) return null;
  return { channelId, name, description: description ? decode(description) : null, subscribers, videoCount, links, recent };
}

export function parseFeed(xml: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const title = m[1].match(/<title>([^<]*)<\/title>/)?.[1];
    const published = m[1].match(/<published>([^<]*)<\/published>/)?.[1];
    if (!title || !published || Number.isNaN(Date.parse(published))) continue;
    const description = m[1].match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? "";
    const views = m[1].match(/<media:statistics views="(\d+)"/)?.[1];
    out.push({ title: decode(title.trim()), publishedAt: new Date(published).toISOString(), description: decode(description).slice(0, 600), views: views ? Number(views) : null });
  }
  return out.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function isWithinThreeMonths(ago: string | null): boolean {
  const m = ago?.match(/^(\d+) (second|minute|hour|day|week|month|year)s? ago$/);
  if (!m) return false;
  const n = Number(m[1]);
  if (m[2] === "year") return false;
  if (m[2] === "month") return n < 3;
  if (m[2] === "week") return n <= 13;
  return true;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", cookie: "CONSENT=YES+1" },
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 3_000_000);
  } catch {
    return null;
  }
}

export async function readYouTube(channelUrl: string, now = new Date()): Promise<Evidence> {
  const evidence = emptyEvidence("youtube", channelUrl);
  const html = await fetchText(`${channelUrl}/videos`);
  const page = html ? parseChannelPage(html, channelUrl) : null;
  if (!page) return evidence;

  evidence.subject.name = page.name;
  evidence.subject.handle = channelUrl.match(/\/(@[^/]+)/)?.[1] ?? null;
  evidence.facts.push(`Channel: ${page.name ?? "name not stated"} (${channelUrl})`);
  if (page.subscribers) evidence.facts.push(`Subscribers: ${page.subscribers}`);
  if (page.videoCount) evidence.facts.push(`Videos on the channel: ${page.videoCount}`);
  if (page.links.length) evidence.facts.push(`Links in the channel header: ${page.links.join(", ")}`);
  if (page.description) evidence.blocks.push({ label: "Channel description", text: page.description.slice(0, 2000) });

  const feed = page.channelId ? await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${page.channelId}`) : null;
  const entries = feed ? parseFeed(feed) : [];
  if (entries.length) {
    const ninetyDaysAgo = now.getTime() - 90 * 86_400_000;
    const inWindow = entries.filter((e) => Date.parse(e.publishedAt) >= ninetyDaysAgo).length;
    evidence.facts.push(
      `Videos published in the last 90 days: ${inWindow}${entries.length >= 15 && inWindow === entries.length ? " or more" : ""}`,
      `Most recent upload: ${shortDate(entries[0].publishedAt)}`,
    );
    evidence.blocks.push({
      label: "Most recent videos, newest first (title, date, views, description)",
      text: entries
        .slice(0, 12)
        .map((e) => `- "${e.title}" (${shortDate(e.publishedAt)}${e.views !== null ? `, ${e.views.toLocaleString("en-US")} views` : ""})${e.description ? `: ${e.description.replace(/\s+/g, " ").slice(0, 300)}` : ""}`)
        .join("\n"),
    });
  } else if (page.recent.length) {
    // The public feed is sometimes down (404 on 2026-11-06), so fall back to YouTube's own "3 weeks ago" wording.
    const recentCount = page.recent.filter((v) => isWithinThreeMonths(v.ago)).length;
    evidence.facts.push(`Videos published in about the last 3 months: ${recentCount}${recentCount === page.recent.length ? " or more" : ""}`);
    if (page.recent[0]?.ago) evidence.facts.push(`Most recent upload: ${page.recent[0].ago}`);
    evidence.blocks.push({
      label: "Most recent videos, newest first (title, when, views)",
      text: page.recent.map((v) => `- "${v.title}" (${[v.ago, v.views].filter(Boolean).join(", ")})`).join("\n"),
    });
  }
  // The first non-social header link is usually their own site.
  evidence.linkedWebsite =
    page.links.find((link) => !/youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com|twitter\.com|x\.com|linkedin\.com|linktr\.ee|patreon\.com|amzn\.|amazon\./i.test(link)) ?? null;
  evidence.strength = gradeStrength(evidence);
  return evidence;
}
