/**
 * Fail-on-change gate for data plans that write `links`:
 *   npm run check:links-plan -- plan.json
 * plan.json: [{ "id": "...", "set": { "links": [...] } }] (or { "id", "links" }).
 * Exits 1 when any value differs from what the app's sanitizer would store.
 */
import fs from "node:fs";
import { linksSanitizerDiff } from "../src/lib/productUrl";

const file = process.argv[2];
if (!file) {
  console.error("usage: check-links-plan <plan.json>");
  process.exit(2);
}
const plan = JSON.parse(fs.readFileSync(file, "utf8")) as Array<{ id: string; links?: unknown; set?: { links?: unknown } }>;
let bad = 0;
for (const row of plan) {
  const links = row.set && "links" in row.set ? row.set.links : row.links;
  const problems = linksSanitizerDiff(links);
  if (problems.length) {
    bad++;
    console.log(`FAIL ${row.id}: ${problems.join("; ")}`);
  }
}
console.log(`${plan.length - bad}/${plan.length} items OK`);
process.exit(bad ? 1 : 0);
