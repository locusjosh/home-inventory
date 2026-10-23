// Runs after `next build`: injects the precache list + a content-hash version into out/sw.js.
import fs from "fs";
import path from "path";
import crypto from "crypto";
const OUT = path.resolve("out");
const BASE = "/home-inventory/";
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(path.relative(OUT, p).split(path.sep).join("/"));
  }
})(OUT);
files.sort();
const url = (f) => BASE + f.replace(/(^|\/)index\.html$/, "$1");
const isPhoto = (f) => /^item-photos\/[^/]+\.(jpe?g|png|webp)$/i.test(f);
const isShell = (f) =>
  (/(^|\/)index\.(html|txt)$/.test(f) && !f.startsWith("404/")) ||
  f.startsWith("_next/static/") ||
  /^(icon-512\.png|manifest\.webmanifest)$/.test(f);
const shell = files.filter(isShell).map(url);
const photos = files.filter(isPhoto).map(url);
const h = crypto.createHash("sha256");
for (const f of [...files.filter(isShell), ...files.filter(isPhoto)]) h.update(f).update(fs.readFileSync(path.join(OUT, f)));
const version = h.digest("hex").slice(0, 12);
const core = [BASE + "items/edit/", BASE + "add/"]; // the Add → item detail path must work offline right after install
const swPath = path.join(OUT, "sw.js");
const src = fs.readFileSync(swPath, "utf8");
const marker = /\/\*__PRECACHE__\*\/ \{[^\n]*\};/;
if (!marker.test(src)) throw new Error("gen-sw: marker not found in out/sw.js");
fs.writeFileSync(swPath, src.replace(marker, `/*__PRECACHE__*/ ${JSON.stringify({ version, core, shell, photos })};`));
console.log(`gen-sw: version ${version}, ${shell.length} shell files, ${photos.length} packshots`);
