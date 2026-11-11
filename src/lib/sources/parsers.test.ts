import { describe, expect, it } from "vitest";
import { summarizeInstagram } from "./instagram";
import { summarizePosts, summarizeProfile } from "./linkedin";
import { detectSignals, htmlToText } from "./website";
import { parseFeed } from "./youtube";

describe("youtube parseFeed", () => {
  it("reads titles, dates, views and descriptions newest first", () => {
    const xml = `<feed><entry><title>Older &amp; wiser</title><published>2026-09-01T10:00:00+00:00</published><media:group><media:description>About budgets</media:description><media:community><media:statistics views="1200"/></media:community></media:group></entry><entry><title>Newest</title><published>2026-10-20T10:00:00+00:00</published></entry></feed>`;
    const entries = parseFeed(xml);
    expect(entries.map((e) => e.title)).toEqual(["Newest", "Older & wiser"]);
    expect(entries[1].views).toBe(1200);
    expect(entries[1].description).toBe("About budgets");
  });
});

describe("instagram summarize", () => {
  it("reads the profile shape returned by apify~instagram-profile-scraper", () => {
    const out = summarizeInstagram({
      username: "acmecoffee",
      fullName: "Acme Coffee",
      biography: "Small-batch roaster",
      followersCount: 5400,
      postsCount: 310,
      externalUrl: "https://acmecoffee.example",
      businessCategoryName: "None",
      private: false,
      latestPosts: [{ timestamp: "2026-11-01T12:00:00.000Z", type: "Image", likesCount: 88, commentsCount: 4, caption: "New roast" }],
    });
    expect(out.found).toBe(true);
    expect(out.facts).toContain("Followers: 5,400");
    expect(out.facts.join(" ")).not.toContain("Category");
    expect(out.linkedWebsite).toBe("https://acmecoffee.example");
    expect(out.blocks.find((b) => b.label.startsWith("Latest posts"))?.text).toContain("88 likes");
  });
  it("marks missing and private accounts", () => {
    expect(summarizeInstagram({ error: "not_found" }).found).toBe(false);
    expect(summarizeInstagram({ username: "x", private: true }).isPrivate).toBe(true);
  });
});

describe("linkedin summarize", () => {
  it("reads profile and posts defensively", () => {
    const profile = summarizeProfile({ firstName: "Dana", lastName: "Ruiz", headline: "VP Operations", about: "30 years in logistics", experience: [{ position: "VP Operations", companyName: "Acme Freight" }], featured: { slides: [{ title: "My talk" }] } });
    expect(profile.name).toBe("Dana Ruiz");
    expect(profile.facts).toContain('Featured on profile: "My talk"');
    expect(profile.blocks.map((b) => b.label)).toContain("Experience, most recent first");
    const posts = summarizePosts([{ content: "Hello world", postedAt: { date: "2026-10-01T00:00:00Z" } }, { content: "" }]);
    expect(posts).toHaveLength(1);
  });
});

describe("website signals", () => {
  it("separates a contact form from a list sign-up", () => {
    const contact = detectSignals(['<form><input type="email" name="email"><textarea name="message"></textarea></form>'], ["Contact us"]);
    expect(contact.emailSignup).toBe(false);
    expect(contact.contactForm).toBe(true);
    const signup = detectSignals(['<form action="https://x.list-manage.com/subscribe"><input type="email"></form>'], ["Join our newsletter"]);
    expect(signup.emailSignup).toBe(true);
  });
  it("turns HTML into readable text", () => {
    const page = htmlToText('<title>Acme | Home</title><meta name="description" content="We roast coffee in Austin."><script>bad()</script><h1>Hi</h1><p>Fresh &amp; local</p>');
    expect(page.title).toBe("Acme | Home");
    expect(page.description).toBe("We roast coffee in Austin.");
    expect(page.text).toContain("Fresh & local");
    expect(page.text).not.toContain("bad()");
  });
});

describe("youtube parseChannelPage", () => {
  it("reads video lockups with small and large view counts", async () => {
    const { parseChannelPage } = await import("./youtube");
    const lockup = (title: string, views: string, ago: string) =>
      `"lockupMetadataViewModel":{"title":{"content":"${title}"},"metadata":{"contentMetadataViewModel":{"metadataRows":[{"metadataParts":[{"text":{"content":"x"},"accessibilityLabel":"${views}","leadingIcon":{}},{"text":{"content":"y"},"accessibilityLabel":"${ago}"}]}]}}`;
    const html = `<title>Test Channel - YouTube</title>"externalId":"UCxavin2leHCAoDg_dj0dR2g" ${lockup("Big one", "29 thousand views", "7 hours ago")} ${lockup("Small one", "4 views", "2 days ago")}`;
    const page = parseChannelPage(html, "https://www.youtube.com/@test");
    expect(page?.recent.map((v) => v.title)).toEqual(["Big one", "Small one"]);
    expect(page?.recent[0].views).toBe("29 thousand views");
    expect(page?.channelId).toBe("UCxavin2leHCAoDg_dj0dR2g");
  });
});

describe("htmlToText on hostile input", () => {
  it("handles a huge unclosed <script> in linear time and keeps text around tags", () => {
    const started = Date.now();
    const page = htmlToText(`<p>Before</p><script>${"a<".repeat(400_000)}`);
    expect(Date.now() - started).toBeLessThan(500);
    expect(page.text).toBe("Before");
    const many = htmlToText(`${"<meta ".repeat(100_000)}<p>Still fine</p>`);
    expect(many.text).toContain("Still fine");
  });
  it("keeps a bare < in text and skips comments", () => {
    expect(htmlToText("<p>3 < 5</p><!-- hidden --><p>ok</p>").text).toBe("3 < 5\nok");
  });
});


describe("profileLinks", () => {
  it("finds the website and every channel across the profile", async () => {
    const { profileLinks } = await import("./linkedin");
    const out = profileLinks({
      profileActions: [{ url: "https://calendly.com/x" }, { url: "https://www.franklinlaser.com/" }],
      websites: [{ url: "https://www.youtube.com/@FranklinSkinandLaser" }],
      contactInfo: { twitter: "https://x.com/drfelice" },
      about: "Follow us at https://www.instagram.com/franklinskinandlaser and https://www.franklinlaser.com.",
      featured: { items: [{ url: "https://www.facebook.com/FranklinSkinandLaser" }] },
    });
    expect(out.website).toBe("https://www.franklinlaser.com/");
    expect([...out.channels].sort()).toEqual(
      ["https://www.youtube.com/@FranklinSkinandLaser", "https://x.com/drfelice", "https://www.instagram.com/franklinskinandlaser", "https://www.facebook.com/FranklinSkinandLaser"].sort(),
    );
  });
  it("returns nothing for a profile with no links", async () => {
    const { profileLinks } = await import("./linkedin");
    expect(profileLinks({ about: "Dermatologist in Franklin." })).toEqual({ website: null, channels: [] });
  });
});
