/**
 * Turns whatever a prospect pastes into one canonical URL for the configured
 * source, or throws an Error whose message is safe to show them. Used by the
 * browser (instant feedback) and the server (the real check). No Node APIs.
 */
import type { SourceType } from "./settings";

const PROMPTS: Record<SourceType, string> = {
  website: "Enter a website address, such as yourbusiness.com.",
  linkedin: "Enter a LinkedIn profile link, such as linkedin.com/in/yourname.",
  youtube: "Enter a YouTube channel link, such as youtube.com/@yourchannel.",
  instagram: "Enter an Instagram profile, such as instagram.com/yourname or @yourname.",
};

export function sourceExample(type: SourceType): string {
  return PROMPTS[type];
}

function toUrl(raw: string, type: SourceType): URL {
  const value = raw.trim();
  if (!value) throw new Error(PROMPTS[type]);
  if (value.length > 500) throw new Error("That link is too long. " + PROMPTS[type]);
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error(PROMPTS[type]);
  }
}

function assertPlainWeb(url: URL, type: SourceType): void {
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) {
    throw new Error(PROMPTS[type]);
  }
}

export function normalizeSourceUrl(type: SourceType, raw: string): string {
  switch (type) {
    case "website":
      return normalizeWebsite(raw);
    case "linkedin":
      return normalizeLinkedIn(raw);
    case "youtube":
      return normalizeYouTube(raw);
    case "instagram":
      return normalizeInstagram(raw);
  }
}

const BLOCKED_SITE_HOSTS = /(^|\.)(linkedin\.com|youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com)$/i;

export function normalizeWebsite(raw: string): string {
  const url = toUrl(raw, "website");
  assertPlainWeb(url, "website");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // IP literals, localhost and single-label names are never a business website.
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[") || /(^|\.)localhost$/.test(host) || /\.(local|internal|lan|home|corp)$/.test(host)) {
    throw new Error(PROMPTS.website);
  }
  if (BLOCKED_SITE_HOSTS.test(host)) {
    throw new Error("That's a social profile, not a website. Enter the business website, such as yourbusiness.com.");
  }
  const path = url.pathname.replace(/\/+$/, "");
  return `https://${host}${path}`;
}

export function normalizeLinkedIn(raw: string): string {
  const url = toUrl(raw, "linkedin");
  assertPlainWeb(url, "linkedin");
  const host = url.hostname.toLowerCase();
  const hostOk = host === "linkedin.com" || host === "www.linkedin.com" || /^[a-z]{2}\.linkedin\.com$/.test(host);
  const match = url.pathname.match(/^\/in\/([a-z0-9_%~.-]{2,100})\/?$/i);
  if (!hostOk || !match) {
    if (hostOk && /^\/company\//i.test(url.pathname)) {
      throw new Error("That's a company page. This report reads personal profiles, such as linkedin.com/in/yourname.");
    }
    throw new Error(PROMPTS.linkedin);
  }
  return `https://www.linkedin.com/in/${match[1]}`;
}

export function normalizeYouTube(raw: string): string {
  const url = toUrl(raw.trim().replace(/^@/, "youtube.com/@"), "youtube");
  assertPlainWeb(url, "youtube");
  const host = url.hostname.toLowerCase();
  if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (host === "youtu.be") throw new Error("That's a video link. Paste the channel link instead, such as youtube.com/@yourchannel.");
    throw new Error(PROMPTS.youtube);
  }
  if (/^\/(watch|shorts|live|embed|playlist)\b/i.test(url.pathname)) {
    throw new Error("That's a video link. Paste the channel link instead, such as youtube.com/@yourchannel.");
  }
  const match = url.pathname.match(/^\/(@[A-Za-z0-9._-]{2,100}|channel\/UC[A-Za-z0-9_-]{20,30}|c\/[A-Za-z0-9._-]{1,100}|user\/[A-Za-z0-9._-]{1,100})(\/.*)?$/);
  if (!match) throw new Error(PROMPTS.youtube);
  return `https://www.youtube.com/${match[1]}`;
}

const INSTAGRAM_RESERVED = new Set(["p", "reel", "reels", "explore", "stories", "tv", "accounts", "direct", "about", "developer", "legal"]);

export function normalizeInstagram(raw: string): string {
  const trimmed = raw.trim();
  const bare = trimmed.match(/^@?([A-Za-z0-9._]{1,30})$/);
  let username: string | null = bare && !trimmed.includes(".com") ? bare[1] : null;
  if (!username) {
    const url = toUrl(trimmed, "instagram");
    assertPlainWeb(url, "instagram");
    const host = url.hostname.toLowerCase();
    if (!["instagram.com", "www.instagram.com", "m.instagram.com"].includes(host)) throw new Error(PROMPTS.instagram);
    const match = url.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?/);
    if (!match) throw new Error(PROMPTS.instagram);
    username = match[1];
  }
  if (INSTAGRAM_RESERVED.has(username.toLowerCase())) {
    throw new Error("That's a post or page link. Paste the profile instead, such as instagram.com/yourname.");
  }
  if (/^\.|\.$|\.\./.test(username)) throw new Error(PROMPTS.instagram);
  return `https://www.instagram.com/${username.toLowerCase()}/`;
}

export function instagramUsername(canonical: string): string {
  return canonical.replace(/^https:\/\/www\.instagram\.com\//, "").replace(/\/$/, "");
}
