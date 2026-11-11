import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fillName, parseSettings } from "./settings";

const examplesDir = path.join(__dirname, "../../examples");
const example = readFileSync(path.join(examplesDir, "second-act-map.yaml"), "utf8");

describe("parseSettings", () => {
  it("accepts every worked example", () => {
    for (const file of readdirSync(examplesDir).filter((f) => f.endsWith(".yaml"))) {
      const result = parseSettings(readFileSync(path.join(examplesDir, file), "utf8"));
      expect(result.ok, file).toBe(true);
    }
  });

  it("accepts the same settings as JSON and inside a code fence", () => {
    const parsed = parseSettings(example);
    if (!parsed.ok) throw new Error("example should parse");
    const json = JSON.stringify(parsed.settings, null, 2);
    expect(parseSettings(json).ok).toBe(true);
    expect(parseSettings("```yaml\n" + example + "\n```").ok).toBe(true);
  });

  it("fills defaults", () => {
    const parsed = parseSettings(example);
    if (!parsed.ok) throw new Error("example should parse");
    expect(parsed.settings.limits.perVisitorPerDay).toBe(3);
    expect(parsed.settings.sections[0].style).toBe("paragraph");
    expect(parsed.settings.tracking).toEqual({});
  });

  it("explains a missing setting by name", () => {
    const result = parseSettings(example.replace(/^cta:[\s\S]*?(?=^branding:)/m, ""));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/cta is missing/);
  });

  it("names unknown settings, bad enums, bad colors and bad links", () => {
    const broken = example
      .replace("type: linkedin", "type: tiktok")
      .replace('primaryColor: "#1f3a5f"', 'primaryColor: "blue"')
      .replace('url: "https://example.com/book"', "url: example.com/book")
      .replace('name: "Second-Act Map"', 'name: "Second-Act Map"\ncolour: red');
    const result = parseSettings(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const all = result.errors.join("\n");
    expect(all).toMatch(/source > type must be one of: website, linkedin, youtube, instagram/);
    expect(all).toMatch(/branding > primaryColor must be a color code/);
    expect(all).toMatch(/cta > url must be a full link/);
    expect(all).toMatch(/doesn't know: colour/);
  });

  it("enforces 3 to 6 sections", () => {
    const parsed = parseSettings(example);
    if (!parsed.ok) throw new Error("example should parse");
    const tooFew = { ...parsed.settings, sections: parsed.settings.sections.slice(0, 2) };
    const result = parseSettings(JSON.stringify(tooFew));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/sections needs at least 3 entries/);
  });

  it("reports broken YAML with a line number", () => {
    const result = parseSettings("name: Test\nsource:\n  type: website\n wording: [");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/^Line \d+/);
  });

  it("rejects empty and non-object input", () => {
    expect(parseSettings("").ok).toBe(false);
    expect(parseSettings("just some words").ok).toBe(false);
  });

  it("rejects javascript: links and non-https logos", () => {
    const result = parseSettings(example.replace('url: "https://example.com/book"', "url: javascript:alert(1)").replace("branding:\n", "branding:\n  logoUrl: http://example.com/logo.png\n"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/cta > url/);
      expect(result.errors.join(" ")).toMatch(/branding > logoUrl must be a full web address that starts with https/);
    }
  });
});

describe("fillName", () => {
  it("fills or removes the name cleanly", () => {
    expect(fillName("{name}, here's your map", "Dana")).toBe("Dana, here's your map");
    expect(fillName("{name}, here's your map", null)).toBe("here's your map");
    expect(fillName("Your map, {name}", null)).toBe("Your map");
    expect(fillName("Here's your map", null)).toBe("Here's your map");
  });
});

describe("IDEA-GENERATOR.md", () => {
  const md = readFileSync(path.join(__dirname, "../../IDEA-GENERATOR.md"), "utf8");
  const blocks = [...md.matchAll(/```yaml\n([\s\S]*?)```/g)].map((m) => m[1]);

  it("has 3 worked examples that all pass the checker", () => {
    expect(blocks).toHaveLength(3);
    for (const block of blocks) {
      const result = parseSettings(block);
      expect(result.ok, result.ok ? "" : result.errors.join("; ")).toBe(true);
    }
  });

  it("matches the files in examples/", () => {
    const files = ["channel-money-map", "second-act-map", "desk-job-energy-plan"].map((name) => readFileSync(path.join(examplesDir, `${name}.yaml`), "utf8"));
    blocks.forEach((block, index) => expect(files[index].endsWith(block)).toBe(true));
  });
});


describe("secondary call to action", () => {
  const base = readFileSync("examples/second-act-map.yaml", "utf8");
  it("accepts a button with a link", () => {
    const result = parseSettings(base.replace(/^cta:\n/m, 'cta:\n  secondaryText: "Not ready for a call?"\n  secondaryButtonText: "Get the free guide"\n  secondaryUrl: "https://example.com/guide"\n'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.settings.cta.secondaryUrl).toBe("https://example.com/guide");
  });
  it("refuses a button without a link", () => {
    const result = parseSettings(base.replace(/^cta:\n/m, 'cta:\n  secondaryButtonText: "Get the free guide"\n'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/go together/);
  });
});
