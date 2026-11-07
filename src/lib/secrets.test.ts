import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.MAGNET_DATA_DIR = mkdtempSync(path.join(tmpdir(), "magnet-secrets-"));
});

describe("signing secret", () => {
  it("is random, created once, and survives a restart", async () => {
    const { signingSecret, resetSigningSecretCache } = await import("./secrets");
    const first = await signingSecret();
    expect(first.length).toBe(32);
    resetSigningSecretCache();
    expect((await signingSecret()).equals(first)).toBe(true);
  });

  it("signs links with the stored secret, not the admin password", async () => {
    const { linkSignature, verifyLinkSignature, resetSigningSecretCache } = await import("./secrets");
    const { kv } = await import("./store");
    process.env.ADMIN_PASSWORD = "correct horse battery staple";
    const url = "https://www.youtube.com/@example";
    const sig = await linkSignature(url);
    expect(await verifyLinkSignature(url, sig)).toBe(true);
    expect(await verifyLinkSignature("https://www.youtube.com/@other", sig)).toBe(false);

    // Same password, different stored secret: the old signature no longer verifies,
    // so the signature carries no information about the password.
    await kv().set("secret/signing", { value: Buffer.alloc(32, 7).toString("base64url") });
    resetSigningSecretCache();
    expect(await verifyLinkSignature(url, sig)).toBe(false);

    // Changing the password doesn't change signatures either.
    const fresh = await linkSignature(url);
    process.env.ADMIN_PASSWORD = "a completely different password";
    expect(await linkSignature(url)).toBe(fresh);
  });

  it("signs background jobs the same way", async () => {
    const { jobSignature, verifyJobSignature } = await import("./secrets");
    const sig = await jobSignature("mw5abc123def456");
    expect(await verifyJobSignature("mw5abc123def456", sig)).toBe(true);
    expect(await verifyJobSignature("mw5abc123def457", sig)).toBe(false);
    expect(await verifyJobSignature("mw5abc123def456", "")).toBe(false);
  });
});

describe("admin password", () => {
  it("needs at least 12 characters", async () => {
    const { adminConfigured, MIN_PASSWORD_LENGTH } = await import("./secrets");
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    process.env.ADMIN_PASSWORD = "elevenchars";
    expect(adminConfigured()).toBe(false);
    process.env.ADMIN_PASSWORD = "twelve chars";
    expect(adminConfigured()).toBe(true);
  });
});

describe("identityKey", () => {
  it("groups IPv6 by /64 and unwraps IPv4-mapped addresses", async () => {
    const { identityKey } = await import("./secrets");
    expect(identityKey("2001:db8:1:2:aaaa::1")).toBe(identityKey("2001:db8:1:2:ffff:ffff:ffff:ffff"));
    expect(identityKey("2001:db8:1:2::1")).not.toBe(identityKey("2001:db8:1:3::1"));
    expect(identityKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(identityKey("203.0.113.9")).toBe("203.0.113.9");
  });
});
