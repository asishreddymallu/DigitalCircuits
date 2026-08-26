/**
 * Build orchestrator for the Digital Circuits Suite.
 *
 * Each web app is a self-contained static bundle: its TypeScript sources are
 * bundled (esbuild, IIFE, ES2020) into the app folder's committed `script.js`,
 * which `index.html` loads via a classic <script> tag. This preserves the
 * original deployment model (plain static files) while allowing modular
 * TypeScript sources.
 *
 * Usage:
 *   node scripts/build.mjs          # build all apps
 *   node scripts/build.mjs web1     # build one app
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const APPS = {
  web1: { entry: "Web1/src/main.ts", outfile: "Web1/script.js" },
  web2: { entry: "Web2/script.ts", outfile: "Web2/script.js" },
  web3: { entry: "Web3/script.ts", outfile: "Web3/script.js" }
};

const targets = process.argv[2] ? [process.argv[2]] : Object.keys(APPS);

for (const target of targets) {
  const app = APPS[target];
  if (!app) {
    console.error(`Unknown app "${target}". Valid targets: ${Object.keys(APPS).join(", ")}`);
    process.exit(1);
  }
  mkdirSync(dirname(resolve(root, app.outfile)), { recursive: true });
  const result = await build({
    entryPoints: [resolve(root, app.entry)],
    outfile: resolve(root, app.outfile),
    bundle: true,
    format: "iife",
    target: ["es2020"],
    legalComments: "none",
    minify: false,
    sourcemap: false,
    logLevel: "silent",
    metafile: true
  });
  const kb = (result.metafile.outputs[Object.keys(result.metafile.outputs)[0]].bytes / 1024).toFixed(1);
  console.log(`✔ ${target.padEnd(5)} ${app.outfile} (${kb} kB)`);
}
