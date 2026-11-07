import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateAddress, pinnedLookup, resolvePublicUrl, safeFetch, type Resolver, type Transport } from "./safe-fetch";

const resolverFor = (addresses: string[]): Resolver => async () => addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));

describe("isPrivateAddress", () => {
  it("flags private, loopback, link-local, CGNAT, multicast and reserved IPv4", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "240.0.0.1", "255.255.255.255", "198.18.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("flags every IPv6 form that can reach loopback or an embedded IPv4", () => {
    for (const ip of ["::1", "::", "::ffff:127.0.0.1", "::ffff:7f00:1", "::7f00:1", "::127.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::", "2001:0:4136:e378::1", "fd00::1", "fe80::1", "fe80::1%en0", "ff02::1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700:4700::1111", "2a00:1450:4001:80b::200e"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
  it("treats anything that isn't an IP as unsafe", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("resolvePublicUrl", () => {
  it("refuses literal private IPs in every spelling WHATWG URL produces", async () => {
    for (const url of [
      "http://[::ffff:127.0.0.1]/",
      "http://[::ffff:7f00:1]/",
      "http://[::7f00:1]/",
      "http://[2002:7f00:1::]/",
      "http://[64:ff9b::a9fe:a9fe]/",
      "http://169.254.169.254/latest/meta-data",
      "http://2130706433/",
      "http://0x7f.1/",
      "http://[::1]/",
    ]) {
      await expect(assertPublicUrl(url), url).rejects.toThrow();
    }
  });
  it("refuses odd ports, schemes, credentials and localhost names", async () => {
    for (const url of ["https://example.com:8443/", "http://example.com:443/", "file:///etc/passwd", "http://localhost/", "http://foo.localhost/", "https://user:pw@example.com/"]) {
      await expect(assertPublicUrl(url, resolverFor(["93.184.216.34"])), url).rejects.toThrow();
    }
  });
  it("refuses a hostname when any resolved address is private", async () => {
    await expect(resolvePublicUrl("https://rebind.example/", resolverFor(["93.184.216.34", "127.0.0.1"]))).rejects.toThrow("private_address");
    await expect(resolvePublicUrl("https://mapped.example/", resolverFor(["::ffff:7f00:1"]))).rejects.toThrow("private_address");
  });
  it("returns the checked public address to pin", async () => {
    const checked = await resolvePublicUrl("https://ok.example/path", resolverFor(["93.184.216.34"]));
    expect(checked.address).toBe("93.184.216.34");
    expect(checked.family).toBe(4);
  });
});

describe("pinnedLookup", () => {
  it("answers with the pinned address in both callback shapes, whatever name is asked", () => {
    const lookup = pinnedLookup("93.184.216.34", 4) as unknown as (h: string, o: { all?: boolean }, cb: (...a: unknown[]) => void) => void;
    lookup("evil.example", {}, (err, address, family) => {
      expect(err).toBeNull();
      expect(address).toBe("93.184.216.34");
      expect(family).toBe(4);
    });
    lookup("evil.example", { all: true }, (err, list) => {
      expect(err).toBeNull();
      expect(list).toEqual([{ address: "93.184.216.34", family: 4 }]);
    });
  });
});

describe("safeFetch", () => {
  it("never connects when the name resolves to a private address", async () => {
    await expect(safeFetch("https://internal.example/", { resolver: resolverFor(["10.0.0.5"]) })).rejects.toThrow("private_address");
  });
});

describe("safeFetch redirects", () => {
  const resolver: Resolver = async (host) => {
    const table: Record<string, string> = { "public.example": "93.184.216.34", "rebind.example": "10.0.0.1" };
    const address = table[host];
    if (!address) throw new Error("nxdomain");
    return [{ address, family: 4 }];
  };

  it("re-checks every redirect hop and never requests a private target", async () => {
    for (const location of ["http://169.254.169.254/latest/meta-data", "http://[::ffff:7f00:1]/", "http://rebind.example/", "http://public.example:8080/"]) {
      const calls: string[] = [];
      const transport: Transport = async (target) => {
        calls.push(`${target.url.hostname}@${target.address}`);
        return { status: 302, location, contentType: "", body: "" };
      };
      await expect(safeFetch("https://public.example/start", { resolver, transport }), location).rejects.toThrow();
      expect(calls, location).toEqual(["public.example@93.184.216.34"]);
    }
  });

  it("follows public redirects and pins each hop to its checked address", async () => {
    const calls: string[] = [];
    const transport: Transport = async (target) => {
      calls.push(`${target.url.toString()}@${target.address}`);
      return calls.length === 1 ? { status: 301, location: "/next", contentType: "", body: "" } : { status: 200, location: null, contentType: "text/html", body: "ok" };
    };
    const res = await safeFetch("http://public.example/", { resolver, transport });
    expect(res.body).toBe("ok");
    expect(calls).toEqual(["http://public.example/@93.184.216.34", "http://public.example/next@93.184.216.34"]);
  });
});
