/**
 * Everything a prospect sees comes from one settings block that the owner
 * pastes into /admin. This file is the only place that decides what a valid
 * block looks like. Errors are written for beginners: they name the setting
 * and say what to change, never a stack trace.
 *
 * YAML is a superset of JSON, so one parser handles both.
 */
import { parse as parseYaml, YAMLParseError } from "yaml";
import { z } from "zod";

export const SOURCE_TYPES = ["website", "linkedin", "youtube", "instagram"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SECTION_STYLES = ["paragraph", "list", "steps", "scores"] as const;
export type SectionStyle = (typeof SECTION_STYLES)[number];

const HEX = /^#[0-9a-fA-F]{6}$/;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => isUrl(v, ["https:"]), { message: "must be a full web address that starts with https://" });

const ctaUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => isUrl(v, ["https:", "http:", "mailto:"]), {
    message: "must be a full link that starts with https:// (or mailto: for an email address)",
  });

function isUrl(value: string, protocols: string[]): boolean {
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol)) return false;
    if (url.protocol === "mailto:") return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url.pathname);
    return url.hostname.includes(".") && !url.username && !url.password;
  } catch {
    return false;
  }
}

const Section = z.strictObject({
  title: text(2, 80),
  intro: optionalText(500),
  asks: text(10, 800),
  style: z.enum(SECTION_STYLES).default("list"),
  items: z.number().int().min(1).max(7).default(3),
});

export const SettingsSchema = z.strictObject({
  version: z.literal(1).default(1),
  name: text(2, 60),
  source: z.strictObject({
    type: z.enum(SOURCE_TYPES),
    alsoReadWebsite: z.boolean().default(true),
    linkedinPosts: z.number().int().min(0).max(30).default(10),
  }),
  about: z.strictObject({
    owner: text(2, 200),
    offer: text(5, 600),
    reader: text(5, 400),
  }),
  lens: z.array(text(10, 300)).min(1).max(6),
  sections: z.array(Section).min(3).max(6),
  wording: z.strictObject({
    headline: text(5, 140),
    subheadline: optionalText(300),
    inputLabel: text(3, 80),
    inputPlaceholder: optionalText(80),
    buttonText: text(2, 40),
    loadingText: optionalText(200),
    reportHeadline: text(3, 140),
    reportIntro: optionalText(600),
    closing: optionalText(800),
  }),
  cta: z
    .strictObject({
      heading: optionalText(140),
      text: optionalText(600),
      buttonText: text(2, 50),
      url: ctaUrl,
      /** A quieter second step for readers who aren't ready for the first (a free guide, a newsletter). */
      secondaryText: optionalText(300),
      secondaryButtonText: optionalText(50),
      secondaryUrl: ctaUrl.optional(),
    })
    .refine((cta) => Boolean(cta.secondaryButtonText?.trim()) === Boolean(cta.secondaryUrl), {
      message: "secondaryButtonText and secondaryUrl go together: give both or neither",
      path: ["secondaryUrl"],
    }),
  branding: z
    .strictObject({
      logoUrl: httpsUrl.optional(),
      primaryColor: z.string().trim().regex(HEX, "must be a color code like #1557b2").default("#1557b2"),
      accentColor: z.string().trim().regex(HEX, "must be a color code like #f5b700").optional(),
      backgroundColor: z.string().trim().regex(HEX, "must be a color code like #ffffff").default("#ffffff"),
      textColor: z.string().trim().regex(HEX, "must be a color code like #111111").default("#111111"),
    })
    .default({ primaryColor: "#1557b2", backgroundColor: "#ffffff", textColor: "#111111" }),
  tracking: z
    .strictObject({
      metaPixelId: z.string().trim().regex(/^\d{5,20}$/, "must be the number from Meta Events Manager, digits only").optional(),
      gtmId: z.string().trim().regex(/^GTM-[A-Z0-9]{4,12}$/, "must look like GTM-ABC1234").optional(),
    })
    .default({}),
  publicMode: z
    .strictObject({
      optIn: z.boolean().default(false),
      heading: optionalText(140),
      buttonText: optionalText(40),
      consentText: optionalText(400),
      crmWebhookUrl: httpsUrl.optional(),
    })
    .default({ optIn: false }),
  limits: z
    .strictObject({
      dailyReports: z.number().int().min(1).max(500).default(20),
      perVisitorPerDay: z.number().int().min(1).max(20).default(3),
      keepReportsDays: z.number().int().min(7).max(365).default(60),
    })
    .default({ dailyReports: 20, perVisitorPerDay: 3, keepReportsDays: 60 }),
  footer: z
    .strictObject({
      text: optionalText(400),
      privacyUrl: httpsUrl.optional(),
    })
    .default({}),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type SectionSettings = Settings["sections"][number];

export type ParseResult =
  | { ok: true; settings: Settings; warnings: string[] }
  | { ok: false; errors: string[] };

/** Removes the ``` fences people copy along with a block from ChatGPT or Claude. */
function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```\s*$/);
  return fenced ? fenced[1] : trimmed;
}

const MAX_SETTINGS_CHARS = 30_000;

export function parseSettings(raw: string): ParseResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, errors: ["The settings box is empty. Paste the whole block from the Idea Generator."] };
  }
  if (raw.length > MAX_SETTINGS_CHARS) {
    return { ok: false, errors: [`That block is too long (${raw.length} characters). Settings should be under ${MAX_SETTINGS_CHARS}.`] };
  }

  let data: unknown;
  try {
    data = parseYaml(stripFences(raw), { maxAliasCount: 0, uniqueKeys: true });
  } catch (err) {
    if (err instanceof YAMLParseError) {
      const line = err.linePos?.[0]?.line;
      const where = line ? `Line ${line}: ` : "";
      return {
        ok: false,
        errors: [
          `${where}the block isn't formatted correctly (${firstLine(err.message)}). The usual causes are a missing space after a colon, mixed tabs and spaces, or a line that lost its indentation when you copied it.`,
        ],
      };
    }
    return { ok: false, errors: ["The block couldn't be read. Copy it again from the Idea Generator, including the first and last lines."] };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, errors: ["The block should start with settings like `name:` and `source:`. Copy the whole block again."] };
  }

  const result = SettingsSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.slice(0, 15).map((issue) => describeIssue(issue, data));
    return { ok: false, errors: [...new Set(errors)] };
  }

  return { ok: true, settings: result.data, warnings: collectWarnings(result.data) };
}

function firstLine(message: string): string {
  return message.split("\n")[0].replace(/ at line \d+, column \d+:?$/, "").trim();
}

function pathLabel(path: PropertyKey[]): string {
  if (path.length === 0) return "The settings";
  return path
    .map((part, index) => (typeof part === "number" ? `#${part + 1}` : index === 0 ? String(part) : `> ${String(part)}`))
    .join(" ")
    .replace(/ #/g, " #");
}

function valueAt(data: unknown, path: PropertyKey[]): unknown {
  let current: unknown = data;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

function describeIssue(issue: z.core.$ZodIssue, data: unknown): string {
  const where = pathLabel(issue.path);
  const actual = valueAt(data, issue.path);
  switch (issue.code) {
    case "invalid_type":
      if (actual === undefined) return `${where} is missing. Add it and save again.`;
      return `${where} should be ${articleFor(issue.expected)}, but it's ${describeValue(actual)}.`;
    case "too_small":
      if (issue.origin === "array") {
        return `${where} needs at least ${issue.minimum} ${issue.minimum === 1 ? "entry" : "entries"}.`;
      }
      if (issue.origin === "string") return `${where} is too short. Write at least ${issue.minimum} characters.`;
      return `${where} must be ${issue.minimum} or more.`;
    case "too_big":
      if (issue.origin === "array") return `${where} can have at most ${issue.maximum} entries. Remove ${countOver(actual, issue.maximum)}.`;
      if (issue.origin === "string") return `${where} is too long. Keep it under ${issue.maximum} characters.`;
      return `${where} must be ${issue.maximum} or less.`;
    case "invalid_value":
      return `${where} must be one of: ${issue.values.map(String).join(", ")}.`;
    case "unrecognized_keys":
      return `${where} has a setting this engine doesn't know: ${issue.keys.join(", ")}. Check the spelling, or delete it.`;
    case "invalid_format":
      return `${where} ${issue.message}.`;
    default:
      return `${where} ${issue.message.charAt(0).toLowerCase()}${issue.message.slice(1)}${issue.message.endsWith(".") ? "" : "."}`;
  }
}

function articleFor(expected: string): string {
  if (expected === "array") return "a list (lines that start with a dash)";
  if (expected === "object") return "a group of settings (indented lines underneath)";
  if (expected === "boolean") return "true or false";
  if (expected === "number") return "a number";
  return `a ${expected}`;
}

function describeValue(value: unknown): string {
  if (value === null) return "empty";
  if (Array.isArray(value)) return "a list";
  if (typeof value === "object") return "a group of settings";
  if (typeof value === "string") return "text";
  return typeof value;
}

function countOver(value: unknown, max: number | bigint): string {
  const over = Array.isArray(value) ? value.length - Number(max) : 1;
  return over === 1 ? "1" : `${over}`;
}

function collectWarnings(settings: Settings): string[] {
  const warnings: string[] = [];
  if (settings.publicMode.optIn && !settings.publicMode.crmWebhookUrl) {
    warnings.push("Public mode is on but there's no crmWebhookUrl, so new leads are only saved on the Leads tab here, not sent to your CRM.");
  }
  if (!settings.publicMode.optIn && settings.publicMode.crmWebhookUrl) {
    warnings.push("You added a crmWebhookUrl but public mode is off (optIn: false), so no one is asked for their email.");
  }
  if (settings.source.type === "instagram") {
    warnings.push("Instagram reads cost about $0.003 each on Apify and only work on public accounts.");
  }
  if (settings.source.type === "linkedin") {
    const perReport = 0.004 + settings.source.linkedinPosts * 0.002;
    warnings.push(`LinkedIn reads cost up to about $${perReport.toFixed(3)} each on Apify (the profile plus up to ${settings.source.linkedinPosts} posts).`);
  }
  return warnings;
}

/** Fills `{name}` in fixed wording, or removes it cleanly when there's no name. */
export function fillName(template: string, name: string | null): string {
  if (name) return template.replaceAll("{name}", name);
  return template
    .replace(/,?\s*\{name\}\s*,?/g, (match) => (match.trim().startsWith(",") && match.trim().endsWith(",") ? ", " : " "))
    .replace(/\s+([,.!?:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
