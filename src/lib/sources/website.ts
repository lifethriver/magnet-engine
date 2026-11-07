/**
 * Reads a public website: the homepage plus up to three pages that look like
 * About, Services, Team or Pricing. Plain fetch through safeFetch (public
 * hosts only), no provider, no cost. Ported from the Shortlist Report.
 */
import { safeFetch } from "../safe-fetch";
import { emptyEvidence, gradeStrength, type Evidence } from "./types";

const MAX_PAGE_CHARS = 5000;
const MAX_PAGES = 4;

const PLATFORMS: [RegExp, string][] = [
  [/list-manage\.com|mailchimp/i, "Mailchimp"],
  [/convertkit|kit\.com\/forms|ck\.page/i, "Kit"],
  [/beehiiv/i, "Beehiiv"],
  [/substack/i, "Substack"],
  [/hsforms|hubspot/i, "HubSpot"],
  [/activehosted|activecampaign/i, "ActiveCampaign"],
  [/klaviyo/i, "Klaviyo"],
  [/flodesk/i, "Flodesk"],
  [/mailerlite/i, "MailerLite"],
  [/leadconnectorhq|msgsndr/i, "GoHighLevel"],
  [/calendly\.com/i, "Calendly booking"],
  [/shopify/i, "Shopify"],
  [/squarespace/i, "Squarespace"],
  [/wix\.com|wixstatic/i, "Wix"],
  [/wp-content|wordpress/i, "WordPress"],
];

export interface SiteSignals {
  emailSignup: boolean;
  contactForm: boolean;
  blog: boolean;
  booking: boolean;
  platforms: string[];
  socialLinks: string[];
}

const SKIP_CONTENT = new Set(["script", "style", "noscript", "svg", "template", "iframe"]);
const BLOCK_END = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "section", "article", "br", "header", "footer"]);

function attribute(tag: string, name: string): string | null {
  // Bounded, non-backtracking match on one tag's text (tags are capped at 2,000 characters below).
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

/**
 * Turns HTML into readable text in one left-to-right pass using indexOf, so
 * a huge or malformed page (an unclosed <script>, say) costs linear time
 * instead of the backtracking a regex like <script[\s\S]*?<\/script> can hit.
 */
export function htmlToText(html: string): { title: string | null; description: string | null; text: string; links: string[] } {
  const lower = html.toLowerCase();
  const out: string[] = [];
  const links: string[] = [];
  let title: string | null = null;
  let description: string | null = null;
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf("<", i);
    if (open === -1) {
      out.push(html.slice(i));
      break;
    }
    out.push(html.slice(i, open));
    if (lower.startsWith("<!--", open)) {
      const close = lower.indexOf("-->", open + 4);
      i = close === -1 ? html.length : close + 3;
      continue;
    }
    const close = html.indexOf(">", open + 1);
    if (close === -1) break;
    const tag = html.slice(open, Math.min(close + 1, open + 2000));
    const nameMatch = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(tag);
    if (!nameMatch) {
      // A bare "<" in text, not a tag.
      out.push("<");
      i = open + 1;
      continue;
    }
    i = close + 1;
    const name = nameMatch[1].toLowerCase();
    const closing = tag.startsWith("</");
    if (!closing && SKIP_CONTENT.has(name)) {
      const end = lower.indexOf(`</${name}`, i);
      if (end === -1) break;
      const endClose = html.indexOf(">", end);
      i = endClose === -1 ? html.length : endClose + 1;
      out.push(" ");
      continue;
    }
    if (!closing && name === "title" && title === null) {
      const end = lower.indexOf("</title", i);
      if (end !== -1) {
        title = html.slice(i, end).replace(/\s+/g, " ").trim() || null;
        i = end;
      }
      continue;
    }
    if (!closing && name === "meta" && description === null) {
      const key = (attribute(tag, "name") ?? attribute(tag, "property") ?? "").toLowerCase();
      const content = attribute(tag, "content");
      if ((key === "description" || key === "og:description") && content && content.length >= 10) description = content.slice(0, 400);
    }
    if (!closing && name === "a") {
      const href = attribute(tag, "href");
      if (href && !href.startsWith("#")) links.push(href.split("#")[0]);
    }
    if (!closing && /^h[1-3]$/.test(name)) out.push("\n## ");
    else if ((closing && BLOCK_END.has(name)) || name === "br") out.push("\n");
    else out.push(" ");
  }
  const text = decodeEntities(out.join(""))
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title: title ? decodeEntities(title) : null, description: description ? decodeEntities(description) : null, text: text.slice(0, MAX_PAGE_CHARS), links };
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;|&#8217;/g, "'")
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
}

export function detectSignals(htmlPages: string[], textPages: string[]): SiteSignals {
  const html = htmlPages.join("\n");
  const text = textPages.join("\n");
  const platforms = PLATFORMS.filter(([re]) => re.test(html)).map(([, name]) => name);
  const hasEmailField = /<input[^>]+type=["']email["']/i.test(html) || /<input[^>]+(name|id|placeholder)=["'][^"']*e-?mail[^"']*["']/i.test(html);
  const subscribeWords = /\b(newsletter|subscribe|join (our|my) (list|newsletter|community)|free (guide|download|checklist))\b/i.test(text);
  const emailPlatform = platforms.some((p) => !["Calendly booking", "Shopify", "Squarespace", "Wix", "WordPress"].includes(p));
  const emailSignup = emailPlatform || (hasEmailField && subscribeWords);
  const socialLinks = [...new Set([...html.matchAll(/https?:\/\/(?:www\.)?(linkedin\.com\/(?:in|company)\/[^"'\s?#]+|youtube\.com\/[@a-z][^"'\s?#]*|instagram\.com\/[^"'\s?#/]+|facebook\.com\/[^"'\s?#/]+|tiktok\.com\/@[^"'\s?#/]+|x\.com\/[^"'\s?#/]+)/gi)].map((m) => m[1]).filter((link) => !/youtube\.com\/(embed|watch)/i.test(link)))].slice(0, 8);
  return {
    emailSignup,
    contactForm: (hasEmailField || /<form[\s\S]{0,4000}?(message|inquir|contact)/i.test(html)) && !emailSignup,
    blog: /href=["'][^"']*\/(blog|insights|articles|resources|news|podcast)(\/|["'])/i.test(html),
    booking: /calendly\.com|acuityscheduling|tidycal|savvycal|cal\.com\/|book (a|your) (call|consult|session)/i.test(html),
    platforms,
    socialLinks,
  };
}

const INTERESTING = /(about|team|our-story|who-we-are|services|what-we-do|work-with|pricing|programs?|coaching|founder|offer|products?|shop)/i;

export async function readWebsite(url: string): Promise<Evidence> {
  const evidence = emptyEvidence("website", url);
  let home;
  try {
    home = await safeFetch(url, { timeoutMs: 9000 });
  } catch {
    return evidence;
  }
  if (home.status >= 400 || !/html|text/i.test(home.contentType)) return evidence;
  const parsed = htmlToText(home.body);
  const origin = new URL(home.finalUrl).origin;
  evidence.subject.name = parsed.title?.split(/\s[|\-–:]\s/)[0]?.trim().slice(0, 80) ?? null;
  evidence.blocks.push({ label: `Homepage ${home.finalUrl}${parsed.title ? ` (title: ${parsed.title})` : ""}`, text: [parsed.description, parsed.text].filter(Boolean).join("\n") });

  const seen = new Set<string>([home.finalUrl.replace(/\/$/, "")]);
  const candidates: string[] = [];
  for (const href of parsed.links) {
    let absolute: string;
    try {
      absolute = new URL(href, home.finalUrl).toString().split("#")[0].replace(/\/$/, "");
    } catch {
      continue;
    }
    if (!absolute.startsWith(origin) || seen.has(absolute) || !INTERESTING.test(absolute.slice(origin.length))) continue;
    seen.add(absolute);
    candidates.push(absolute);
    if (candidates.length >= MAX_PAGES - 1) break;
  }
  const pages = await Promise.all(
    candidates.map(async (pageUrl) => {
      try {
        const res = await safeFetch(pageUrl, { timeoutMs: 7000 });
        return res.status < 400 && /html|text/i.test(res.contentType) ? { url: res.finalUrl, html: res.body } : null;
      } catch {
        return null;
      }
    }),
  );
  const htmls = [home.body];
  const texts = [parsed.text];
  for (const page of pages) {
    if (!page) continue;
    const p = htmlToText(page.html);
    if (p.text.length < 200) continue;
    htmls.push(page.html);
    texts.push(p.text);
    evidence.blocks.push({ label: `Page ${page.url}${p.title ? ` (title: ${p.title})` : ""}`, text: p.text });
  }

  const signals = detectSignals(htmls, texts);
  evidence.facts.push(`Website: ${home.finalUrl}`);
  evidence.facts.push(`Email sign-up form on the site: ${signals.emailSignup ? "yes" : "no"}`);
  if (signals.contactForm) evidence.facts.push("Contact or inquiry form (not a list sign-up): yes");
  evidence.facts.push(`Blog, articles or podcast section: ${signals.blog ? "yes" : "no"}`);
  evidence.facts.push(`Online booking link: ${signals.booking ? "yes" : "no"}`);
  if (signals.platforms.length) evidence.facts.push(`Tools seen on the site: ${signals.platforms.join(", ")}`);
  if (signals.socialLinks.length) evidence.facts.push(`Social profiles linked from the site: ${signals.socialLinks.join(", ")}`);
  evidence.strength = gradeStrength(evidence);
  return evidence;
}
