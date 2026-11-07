import { describe, expect, it } from "vitest";
import { normalizeInstagram, normalizeLinkedIn, normalizeWebsite, normalizeYouTube } from "./source-urls";

describe("normalizeWebsite", () => {
  it("accepts plain domains and full URLs", () => {
    expect(normalizeWebsite("newsletterlabs.co")).toBe("https://newsletterlabs.co");
    expect(normalizeWebsite("http://www.example.com/about/")).toBe("https://www.example.com/about");
  });
  it("refuses private and odd targets", () => {
    for (const bad of ["localhost", "http://127.0.0.1", "http://10.0.0.5/admin", "http://[::1]/", "http://169.254.169.254/latest", "router.local", "ftp://example.com", "https://user:pw@example.com", "https://example.com:8080", "intranet"]) {
      expect(() => normalizeWebsite(bad), bad).toThrow();
    }
  });
  it("points social links to the right input", () => {
    expect(() => normalizeWebsite("https://www.linkedin.com/in/someone")).toThrow(/social profile/);
  });
});

describe("normalizeLinkedIn", () => {
  it("keeps only /in/ profiles", () => {
    expect(normalizeLinkedIn("linkedin.com/in/justinglover/")).toBe("https://www.linkedin.com/in/justinglover");
    expect(normalizeLinkedIn("https://uk.linkedin.com/in/jane-doe-123")).toBe("https://www.linkedin.com/in/jane-doe-123");
    expect(() => normalizeLinkedIn("https://www.linkedin.com/company/acme")).toThrow(/company page/);
    expect(() => normalizeLinkedIn("https://evil.com/in/x")).toThrow();
  });
});

describe("normalizeYouTube", () => {
  it("accepts handles and channel ids", () => {
    expect(normalizeYouTube("youtube.com/@mkbhd/videos")).toBe("https://www.youtube.com/@mkbhd");
    expect(normalizeYouTube("@mkbhd")).toBe("https://www.youtube.com/@mkbhd");
    expect(normalizeYouTube("https://m.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ")).toBe("https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ");
  });
  it("explains video links", () => {
    expect(() => normalizeYouTube("https://www.youtube.com/watch?v=abc")).toThrow(/video link/);
    expect(() => normalizeYouTube("https://youtu.be/abc")).toThrow(/video link/);
  });
});

describe("normalizeInstagram", () => {
  it("accepts usernames and profile links", () => {
    expect(normalizeInstagram("@HubSpot")).toBe("https://www.instagram.com/hubspot/");
    expect(normalizeInstagram("instagram.com/hubspot?igsh=abc")).toBe("https://www.instagram.com/hubspot/");
    expect(() => normalizeInstagram("https://www.instagram.com/p/Cxyz/")).toThrow(/post/);
    expect(() => normalizeInstagram("https://example.com/hubspot")).toThrow();
  });
});
