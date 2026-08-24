#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const baseUrl = args[0]?.replace(/\/$/, "");
if (!baseUrl) {
  console.error("usage: verify-live.mjs <base-url> [--manifest <file>]");
  process.exit(1);
}
const manifestPath =
  args[args.indexOf("--manifest") + 1] ?? "dist/build-manifest.json";

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const targets = manifest.files.filter((f) => f.url);

console.log(`base:     ${baseUrl}`);
console.log(`commit:   ${manifest.sourceCommit ?? "(unknown)"}`);
console.log(`checking: ${targets.length} files\n`);

const CONCURRENCY = 8;
const mismatched = [];
const unreachable = [];
let checked = 0;

const check = async (file) => {
  const url = `${baseUrl}${file.url}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      unreachable.push({ ...file, reason: `HTTP ${res.status}` });
      return;
    }
    const body = Buffer.from(await res.arrayBuffer());
    const actual = createHash("sha256").update(body).digest("hex");
    if (actual !== file.sha256) {
      mismatched.push({ ...file, actual });
    }
  } catch (err) {
    unreachable.push({ ...file, reason: err.message });
  } finally {
    checked += 1;
    if (checked % 25 === 0) process.stderr.write(`  ${checked}/${targets.length}\r`);
  }
};

const queue = [...targets];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await check(queue.shift());
  }),
);

console.log(`\nmatched:     ${targets.length - mismatched.length - unreachable.length}`);
console.log(`mismatched:  ${mismatched.length}`);
console.log(`unreachable: ${unreachable.length}`);

for (const f of mismatched) {
  console.log(`\nMISMATCH ${f.url}\n  expected ${f.sha256}\n  actual   ${f.actual}`);
}
for (const f of unreachable.slice(0, 20)) {
  console.log(`UNREACHABLE ${f.url} (${f.reason})`);
}

process.exit(mismatched.length > 0 ? 1 : 0);
