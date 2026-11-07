/** Usage: npm run check-settings -- examples/channel-money-map.yaml */
import { readFileSync } from "node:fs";
import { parseSettings } from "../src/lib/settings";

const files = process.argv.slice(2);
let failed = false;
for (const file of files) {
  const result = parseSettings(readFileSync(file, "utf8"));
  if (result.ok) {
    console.log(`OK   ${file}: ${result.settings.name} (${result.settings.source.type}, ${result.settings.sections.length} sections)`);
    for (const warning of result.warnings) console.log(`     note: ${warning}`);
  } else {
    failed = true;
    console.log(`FAIL ${file}`);
    for (const error of result.errors) console.log(`     - ${error}`);
  }
}
process.exit(failed ? 1 : 0);
