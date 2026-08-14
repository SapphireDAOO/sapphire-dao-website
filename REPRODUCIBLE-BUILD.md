# Reproducible builds

A user loading this dApp gets JavaScript that will ask their wallet to sign
transactions. Nothing in the browser tells them that JavaScript came from this
repository rather than from a compromised build server or a hijacked DNS record.

A reproducible build closes that gap: anyone can rebuild a given commit and
confirm, byte for byte, that it matches what the site actually serves.

## What this does and does not prove

**In scope.** Everything the browser receives: all client chunks and CSS under
`/_next/static/`, and the prerendered HTML for each static route. Because every
page in this app is a thin server component wrapping a client component,
essentially all the security-relevant logic — transaction construction, signing
prompts — lives in that verifiable half.

Note that `/dashboard`, `/invoices`, `/marketplace-dashboard` and `/metrics` are
server-rendered on demand, so they emit no prerendered HTML and only `/`,
`/admin`, `/checkout`, `/multisig` and `/pay` are hash-checked as documents.
This costs less than it sounds: those four routes still load the *same* verified
chunks from `/_next/static/`, so the code that builds and signs transactions is
covered either way. Only the initial HTML shell is unverifiable for them.

**Out of scope.** The API routes (`/api/notes`,
`/api/verify-token`, `/api/generate-pay-link`) and the server runtime. Nothing an
outside observer can measure proves which code is running on a server, so hashing
server output would imply a guarantee this cannot give. Those remain a trust
assumption.

Reproducibility also proves only *consistency with source*, never that the source
is safe. A backdoor committed to this repo reproduces perfectly.

## Verifying a deployment

You need Docker and Node. You do not need any of the project's secrets.

```bash
git clone <repo> && cd sapphire-dao-website
git checkout <tag>

./scripts/reproduce.sh <tag>                          # prints a root hash
node scripts/verify-live.mjs https://<the-site>       # compares against live
```

Three outcomes:

- **`REPRODUCIBLE` and 0 mismatched** — the served JS was built from that commit.
- **Hash mismatch vs. the published hash** — your build inputs differ from the
  publisher's, or the published artifact does not match the source. Check
  `publicEnv` in `dist/build-manifest.json` against the published values first;
  that is the usual cause.
- **`verify-live` mismatches** — the site is serving something other than this
  commit. Worth investigating.

`unreachable` files are warnings, not failures: routing rules, auth, or a CDN
404 on an unreferenced asset all produce them.

## Publishing a build

```bash
./scripts/reproduce.sh v1.2.0
```

This writes `dist/build-manifest.json` — per-file hashes, the source commit, the
public env values used, and the root hash. Publish the root hash alongside the
tag, ideally signed. Better still, pin the output to IPFS: a CID *is* a content
hash, which makes the comparison step free and removes the need for anyone to
trust a hash you announced.

## What is pinned, and why

| Input | Pinned by |
|---|---|
| Source | `git archive <commit>` — the committed tree, never your working tree |
| Dependencies | `bun.lock` + `bun install --frozen-lockfile` |
| Package manager | `oven/bun:1.2.18-slim`, by SHA256 digest |
| Node runtime | `node:22.14.0-bookworm-slim`, by SHA256 digest |
| Architecture | `--platform=linux/amd64` |
| Public env | `build-inputs.env` (committed) |
| Build id | `SOURCE_COMMIT` → `generateBuildId` in `next.config.ts` |

Base images are pinned by **digest, not tag**, because tags move. Architecture is
pinned because minifier output can differ across them; on Apple Silicon this runs
emulated and is noticeably slower.

`build-inputs.env` is committed on purpose. `NEXT_PUBLIC_*` values are
string-inlined into the bundle by Next, so they are already readable by anyone
with devtools open, *and* they change the output hash — a verifier who guesses
different values cannot distinguish a mismatch from an attack. Server secrets
(`SECRET_KEY`, `JWT_SECRET`, `GRAPH_API_KEY`, `NOTES_SECRET_KEY`,
`NOTES_SIGNER_PRIVATE_KEY`)
are read at request time, never at build time, and are never passed to the build.

## The two source changes this required

Measured on this repo: two clean builds of one commit differed in 42 entries, but
only two root causes. Client chunks (`static/chunks/**`, `static/css/**`) were
**already byte-identical** — Next already uses deterministic module ids for
client output.

1. **Random build id.** Next generates a fresh nanoid per build, which names the
   `static/<id>/` directory and is embedded in every manifest and prerendered
   page. One random string caused most of the 42 diffs. Fixed by
   `generateBuildId: () => process.env.SOURCE_COMMIT` in `next.config.ts`.

2. **Racing webpack module ids.** In `server/chunks/2332.js` and `8318.js`, ids
   `55009` and `77390` swapped between builds — assigned in compilation-finish
   order, which is not stable. Fixed by `optimization.moduleIds = "deterministic"`
   in the webpack hook. This only affects server chunks, so it is optional given
   the scope above; it is set anyway so the whole build is reproducible.

## Deliberately excluded from the hash

- **Next's JSON manifests** (`build-manifest.json`, `app-paths-manifest.json`,
  …). Their key order follows filesystem scan order and varies between identical
  builds. No browser fetches them.
- **`server-reference-manifest.json`.** Contains an `encryptionKey` that Next
  regenerates randomly per build to encrypt server-action arguments. If you ever
  need this reproducible, pin `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` — though the
  only server action here, `src/app/actions/revalidate.ts`, has no callers.
- **`.next/trace`.** Build telemetry, full of timestamps.

## Limits worth stating plainly

Even done fully, a verifier still trusts that the pinned Docker digests are not
malicious and that `bun.lock` does not pin a backdoored dependency. And this is a
point-in-time check — it says nothing about what the site serves an hour later,
which is the argument for IPFS pinning or an ENS content hash, where bytes are
addressed *by* their hash rather than compared to it after the fact.
