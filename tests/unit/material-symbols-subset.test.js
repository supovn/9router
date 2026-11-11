import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// The dashboard ships a subset of the Material Symbols font (see
// scripts/subset-material-symbols.py). An icon added in src/ or open-sse/ (provider
// registry `icon` fields) — e.g. by an upstream merge — but missing from the
// subset renders as its ligature text.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_DIRS = ["src", "open-sse"].map((d) => path.join(ROOT, d));
const ICON_LIST = path.join(ROOT, "src/app/fonts/material-symbols-outlined.icons.txt");
// Quoted strings, and JSX text nodes that may sit on their own line.
const TOKEN_RE = /["'`]([a-z0-9_]+)["'`]|>\s*([a-z0-9_]+)\s*</g;

function knownIconNames() {
  const require = createRequire(path.join(ROOT, "package.json"));
  const dts = fs.readFileSync(require.resolve("material-symbols/index.d.ts"), "utf8");
  return new Set([...dts.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]));
}

function sourceTokens(dir, out = new Set()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceTokens(full, out);
    else if (/\.(jsx?|css)$/.test(entry.name)) {
      for (const m of fs.readFileSync(full, "utf8").matchAll(TOKEN_RE)) out.add(m[1] || m[2]);
    }
  }
  return out;
}

describe("material symbols subset", () => {
  it("contains every icon name referenced in src/ and open-sse/", () => {
    const subset = new Set(fs.readFileSync(ICON_LIST, "utf8").split(/\r?\n/).filter(Boolean));
    const known = knownIconNames();
    const tokens = new Set();
    for (const dir of SOURCE_DIRS) sourceTokens(dir, tokens);
    const missing = [...tokens].filter((t) => known.has(t) && !subset.has(t)).sort();
    expect(missing, "run: python scripts/subset-material-symbols.py").toEqual([]);
  });
});
