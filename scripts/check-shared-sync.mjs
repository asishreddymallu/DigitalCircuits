/**
 * Guards against drift between the four intentionally duplicated shared
 * scripts (theme.js / fx.js). The suite uses a static multi-page deployment,
 * so each page loads its own copy; this check keeps the copies identical.
 * Run via `npm run check:shared`.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCATIONS = ["", "Web1/", "Web2/", "Web3/"];
const FILES = ["theme.js", "fx.js"];

let failed = false;
for (const file of FILES) {
  const hashes = LOCATIONS.map(dir => {
    try {
      return createHash("sha256").update(readFileSync(resolve(root, dir, file))).digest("hex");
    } catch {
      return "<missing>";
    }
  });
  const allEqual = hashes.every(h => h === hashes[0]);
  if (!allEqual) failed = true;
  console.log(`${allEqual ? "✔" : "✘"} ${file}: ${allEqual ? "identical across all pages" : "DRIFT DETECTED " + JSON.stringify(hashes)}`);
}

process.exit(failed ? 1 : 0);
