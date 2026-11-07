/**
 * Admin checks and every signature in the app.
 *
 * Signatures (pre-filled links, background jobs, hashed visitor IPs) use a
 * random 32-byte secret that the site creates for itself the first time it
 * needs one and keeps in its own storage. It is never derived from
 * ADMIN_PASSWORD, so a public pre-filled link gives nobody anything to crack
 * the password with.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { kv } from "./store";

export const MIN_PASSWORD_LENGTH = 12;
const SECRET_KEY = "secret/signing";

function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value && value.length >= MIN_PASSWORD_LENGTH ? value : null;
}

export function adminConfigured(): boolean {
  return adminPassword() !== null;
}

export function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right) && a.length === b.length;
}

export function isAdminRequest(request: Request): boolean {
  const expected = adminPassword();
  if (!expected) return false;
  const given = request.headers.get("x-admin-password")?.trim() ?? "";
  return given.length > 0 && safeEqual(given, expected);
}

let cachedSecret: Buffer | null = null;

/** The site's signing secret. Created once with onlyIfNew, so concurrent first calls agree. */
export async function signingSecret(): Promise<Buffer> {
  if (cachedSecret) return cachedSecret;
  const store = kv();
  let entry = await store.get<{ value: string }>(SECRET_KEY);
  if (!entry) {
    await store.set(SECRET_KEY, { value: randomBytes(32).toString("base64url"), createdAt: new Date().toISOString() }, { onlyIfNew: true });
    entry = await store.get<{ value: string }>(SECRET_KEY);
  }
  if (!entry || typeof entry.data.value !== "string" || entry.data.value.length < 40) throw new Error("signing_secret_unavailable");
  cachedSecret = Buffer.from(entry.data.value, "base64url");
  return cachedSecret;
}

/** Test hook: forget the cached secret (the store copy stays). */
export function resetSigningSecretCache(): void {
  cachedSecret = null;
}

async function sign(purpose: string, value: string, length = 32): Promise<string> {
  return createHmac("sha256", await signingSecret()).update(`${purpose}:${value}`).digest("base64url").slice(0, length);
}

/** Lets the background function trust that a job request came from this app. */
export function jobSignature(id: string): Promise<string> {
  return sign("job", id);
}

export async function verifyJobSignature(id: string, signature: string): Promise<boolean> {
  return Boolean(signature) && safeEqual(await jobSignature(id), signature);
}

/** A pre-filled link the owner made: skips the opt-in for that one URL. */
export function linkSignature(normalizedUrl: string): Promise<string> {
  return sign("link", normalizedUrl, 22);
}

export async function verifyLinkSignature(normalizedUrl: string, signature: string | null | undefined): Promise<boolean> {
  if (!signature) return false;
  return safeEqual(await linkSignature(normalizedUrl), signature);
}

/** Visitor IPs are only ever stored as a keyed hash. */
export function hashIdentity(value: string): Promise<string> {
  return sign("ip", value, 24);
}

export function newReportKey(): string {
  return randomBytes(18).toString("base64url");
}

export function newReportId(): string {
  // Time first so keys list in creation order.
  return `${Date.now().toString(36)}${randomBytes(5).toString("hex")}`;
}

function expandIPv6(address: string): string[] | null {
  const clean = address.split("%")[0].toLowerCase();
  if (isIP(clean) !== 6) return null;
  const [head, tail] = clean.includes("::") ? clean.split("::") : [clean, ""];
  const toGroups = (part: string) => (part ? part.split(":") : []);
  let headGroups = toGroups(head);
  let tailGroups = toGroups(tail);
  // An embedded dotted IPv4 tail counts as two groups.
  const fix = (groups: string[]) =>
    groups.flatMap((group) => {
      if (!group.includes(".")) return [group];
      const [a, b, c, d] = group.split(".").map(Number);
      return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
    });
  headGroups = fix(headGroups);
  tailGroups = fix(tailGroups);
  const missing = 8 - headGroups.length - tailGroups.length;
  const groups = clean.includes("::") ? [...headGroups, ...Array(missing).fill("0"), ...tailGroups] : headGroups;
  return groups.length === 8 ? groups.map((g) => g.padStart(4, "0")) : null;
}

/**
 * The identity used for per-visitor limits. IPv6 users usually control a
 * whole /64, so addresses are grouped by their first 64 bits; an
 * IPv4-mapped address counts as its IPv4 address.
 */
export function identityKey(ip: string): string {
  const groups = expandIPv6(ip);
  if (!groups) return ip;
  if (groups.slice(0, 5).every((g) => g === "0000") && groups[5] === "ffff") {
    const v4 = [groups[6].slice(0, 2), groups[6].slice(2), groups[7].slice(0, 2), groups[7].slice(2)].map((h) => parseInt(h, 16));
    return v4.join(".");
  }
  return `${groups.slice(0, 4).join(":")}::/64`;
}

export function clientIp(request: Request): string {
  // Netlify sets x-nf-client-connection-ip itself; x-forwarded-for is the fallback elsewhere.
  const raw =
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return identityKey(raw);
}
