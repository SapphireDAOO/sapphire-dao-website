#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  "NEXT_PUBLIC_INFURA_ID",
  "NEXT_PUBLIC_NOTES_SIGNER_ADDRESS",
  "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL",
];

const unsafe = PUBLIC_ENV_KEYS.filter((k) => !k.startsWith("NEXT_PUBLIC_"));
if (unsafe.length > 0) {
  console.error(
    `refusing to build a published manifest containing non-public keys: ${unsafe.join(", ")}\n` +
      "Only NEXT_PUBLIC_* values may be recorded. Server secrets are not build inputs.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const root = args[0];
if (!root) {
  console.error("usage: hash-build.mjs <artifacts-dir> [--commit <sha>] [--out <file>]");
  process.exit(1);
}
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
};

const toUrl = (path) => {
  if (path.startsWith("static/")) return `/_next/${path}`;
  if (!path.startsWith("pages/") || !path.endsWith(".html")) return null;
  const route = path.slice("pages/".length, -".html".length);
  if (route === "index") return "/";
  if (route.startsWith("_")) return null;
  return `/${route}/`;
};

const files = walk(root)
  .map((full) => {
    const path = relative(root, full).split(sep).join("/");
    return {
      path,
      url: toUrl(path),
      bytes: statSync(full).size,
      sha256: createHash("sha256").update(readFileSync(full)).digest("hex"),
    };
  })
  .filter((f) => f.path.startsWith("static/") || f.path.endsWith(".html"))
  .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

const rootHash = createHash("sha256")
  .update(files.map((f) => `${f.sha256}  ${f.path}\n`).join(""))
  .digest("hex");

const publicEnv = Object.fromEntries(
  PUBLIC_ENV_KEYS.map((k) => [k, process.env[k] ?? ""]),
);

const manifest = {
  sourceCommit: flag("--commit") ?? process.env.SOURCE_COMMIT ?? null,
  rootHash,
  fileCount: files.length,
  publicEnv,
  files,
};

const out = flag("--out");
if (out) {
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.error(`wrote ${out}`);
}

console.error(`files:     ${files.length}`);
console.error(`commit:    ${manifest.sourceCommit ?? "(unknown)"}`);
console.error(`root hash: ${rootHash}`);
if (!out) console.log(JSON.stringify(manifest, null, 2));
