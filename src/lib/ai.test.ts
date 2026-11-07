import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildUserPrompt, stripGiveaways } from "./ai";
import { parseSettings } from "./settings";
import { emptyEvidence } from "./sources/types";

describe("stripGiveaways", () => {
  it("drops sentences about how the report was made", () => {
    const text = "You post every week about budgeting. Based on the data we collected, your list is small. Our AI noticed a gap. Your best video is about rent.";
    expect(stripGiveaways(text)).toBe("You post every week about budgeting. Your best video is about rent.");
    expect(stripGiveaways("Your header has 1 link. Without being able to see your descriptions, they likely do less. Add a second link.")).toBe("Your header has 1 link. Add a second link.");
  });
  it("keeps ordinary sentences and removes em dashes", () => {
    expect(stripGiveaways("Your About section is strong — it names your clients.")).toBe("Your About section is strong, it names your clients.");
  });
});

describe("buildUserPrompt", () => {
  const parsed = parseSettings(readFileSync(path.join(__dirname, "../../examples/desk-job-energy-plan.yaml"), "utf8"));
  if (!parsed.ok) throw new Error("example should parse");
  const evidence = emptyEvidence("linkedin", "https://www.linkedin.com/in/x");
  evidence.facts.push("Headline: VP of Sales");

  it("includes lens, numbered sections, notes and evidence in that order", () => {
    const prompt = buildUserPrompt(parsed.settings, evidence, ["I travel twice a month"]);
    const order = ["QUESTIONS THE REPORT ANSWERS", "SECTIONS TO WRITE", "CONVERSATION NOTES", "EVIDENCE"].map((m) => prompt.indexOf(m));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(prompt).toContain('1. "What your role asks of your body" (style: paragraph)');
    expect(prompt).toContain("I travel twice a month");
    expect(prompt).toContain("Headline: VP of Sales");
  });

  it("leaves out the notes block when there are none", () => {
    expect(buildUserPrompt(parsed.settings, evidence, [])).not.toContain("CONVERSATION NOTES");
  });
});
