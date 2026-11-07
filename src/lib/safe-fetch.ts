/**
 * Fetches a URL a stranger gave us (a website to read, a CRM webhook the owner
 * pasted) without letting it reach private networks.
 *
 * - Every hop, including each redirect, must be http(s) on the default port.
 * - The hostname is resolved once, every resolved address is checked against
 *   a BlockList of private, loopback, link-local, CGNAT, multicast, reserved
 *   and IPv4-embedding IPv6 ranges, and the connection is pinned to the
 *   checked address through a custom `lookup`, so nothing re-resolves the
 *   name between the check and the connect (DNS rebinding).
 * - Responses are decompressed here and capped in size and time.
 */
import http from "node:http";
import https from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";

export class UnsafeUrlError extends Error {}

// Two lists: a BlockList checks an IPv4 query against IPv4-mapped IPv6 rules
// too, so ::ffff:0:0/96 in one shared list would block every IPv4 address.
const BLOCKED_V4 = new BlockList();
const BLOCKED_V6 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link local, cloud metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved and broadcast
] as const) {
  BLOCKED_V4.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["::", 96], // IPv4-compatible (::7f00:1)
  ["::ffff:0:0", 96], // IPv4-mapped (::ffff:7f00:1)
  ["64:ff9b::", 96], // NAT64
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64], // discard
  ["2001::", 32], // Teredo, embeds an IPv4 address
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4, embeds an IPv4 address
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link local
  ["ff00::", 8], // multicast
] as const) {
  BLOCKED_V6.addSubnet(network, prefix, "ipv6");
}

export function isPrivateAddress(address: string): boolean {
  const clean = address.replace(/^\[|\]$/g, "").split("%")[0];
  const family = isIP(clean);
  if (family === 4) return BLOCKED_V4.check(clean, "ipv4");
  if (family === 6) return BLOCKED_V6.check(clean, "ipv6");
  return true;
}

export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

const systemResolver: Resolver = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

export interface CheckedUrl {
  url: URL;
  address: string;
  family: 4 | 6;
}

/** Validates the URL and returns the one public address it will be fetched from. */
export async function resolvePublicUrl(raw: string, resolver: Resolver = systemResolver): Promise<CheckedUrl> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("invalid_url");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new UnsafeUrlError("bad_scheme");
  // URL drops a port that equals the scheme default, so any port left is non-default.
  if (url.port) throw new UnsafeUrlError("bad_port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const literal = isIP(host);
  if (literal) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError("private_address");
    return { url, address: host, family: literal as 4 | 6 };
  }
  if (!host.includes(".") || /(^|\.)localhost\.?$/i.test(host)) throw new UnsafeUrlError("private_host");
  let addresses: { address: string; family: number }[];
  try {
    addresses = await resolver(host);
  } catch {
    throw new UnsafeUrlError("dns_failed");
  }
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new UnsafeUrlError("private_address");
  }
  const chosen = addresses[0];
  return { url, address: chosen.address, family: (chosen.family === 6 ? 6 : 4) as 4 | 6 };
}

/** Kept for callers that only need the yes/no check. */
export async function assertPublicUrl(raw: string, resolver?: Resolver): Promise<URL> {
  return (await resolvePublicUrl(raw, resolver)).url;
}

/** A `lookup` that always answers with the address we already checked. */
export function pinnedLookup(address: string, family: 4 | 6): LookupFunction {
  return ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    if (options && options.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  }) as unknown as LookupFunction;
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export interface SafeFetchOptions {
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  resolver?: Resolver;
  /** Tests only: replaces the network call. Production always uses the pinned request. */
  transport?: Transport;
}

export type Transport = (target: CheckedUrl, init: { method: string; body?: string; headers: Record<string, string>; maxBytes: number; signal: AbortSignal }) => Promise<RawResponse>;

export interface SafeFetchResult {
  status: number;
  finalUrl: string;
  contentType: string;
  body: string;
}

export interface RawResponse {
  status: number;
  location: string | null;
  contentType: string;
  body: string;
}

function requestOnce(target: CheckedUrl, init: { method: string; body?: string; headers: Record<string, string>; maxBytes: number; signal: AbortSignal }): Promise<RawResponse> {
  const client = target.url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      target.url,
      {
        method: init.method,
        headers: init.body ? { ...init.headers, "content-length": Buffer.byteLength(init.body).toString() } : init.headers,
        lookup: pinnedLookup(target.address, target.family),
        signal: init.signal,
        // TLS still verifies the certificate against the hostname (SNI uses the URL host).
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const contentType = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400 && location) {
          res.resume();
          resolve({ status, location, contentType, body: "" });
          return;
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: Readable = res;
        if (encoding === "gzip" || encoding === "x-gzip") stream = res.pipe(createGunzip());
        else if (encoding === "br") stream = res.pipe(createBrotliDecompress());
        else if (encoding === "deflate") stream = res.pipe(createInflate());
        const chunks: Buffer[] = [];
        let total = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          res.destroy();
          resolve({ status, location: null, contentType, body: Buffer.concat(chunks).subarray(0, init.maxBytes).toString("utf8") });
        };
        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          total += chunk.length;
          if (total >= init.maxBytes) finish();
        });
        stream.on("end", finish);
        stream.on("error", (err) => (done ? undefined : reject(err)));
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

export async function safeFetch(raw: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { method = "GET", body, timeoutMs = 8000, maxBytes = 800_000, maxRedirects = 4, resolver, transport = requestOnce } = options;
  const signal = AbortSignal.timeout(timeoutMs);
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const target = await resolvePublicUrl(current, resolver);
    const res = await transport(target, {
      method: hop === 0 ? method : "GET",
      body: hop === 0 ? body : undefined,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        ...options.headers,
      },
      maxBytes,
      signal,
    });
    if (res.location) {
      current = new URL(res.location, target.url).toString();
      continue;
    }
    return { status: res.status, finalUrl: target.url.toString(), contentType: res.contentType, body: res.body };
  }
  throw new UnsafeUrlError("too_many_redirects");
}
