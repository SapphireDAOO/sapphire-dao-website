#!/usr/bin/env bash

set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT_ISH="${1:-HEAD}"
SOURCE_COMMIT="$(git rev-parse "$COMMIT_ISH")"
OUT_DIR="dist/reproducible"
MANIFEST="dist/build-manifest.json"

load_public_env() {
  local file="$1" line key val
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      NEXT_PUBLIC_*=*)
        key="${line%%=*}"
        val="${line#*=}"
        val="${val%\"}"; val="${val#\"}"
        val="${val%\'}"; val="${val#\'}"
        export "$key=$val"
        ;;
    esac
  done < "$file"
}

if [ -f build-inputs.env ]; then
  load_public_env build-inputs.env
elif [ -f .env ]; then
  echo "note: build-inputs.env not found, reading NEXT_PUBLIC_* from .env" >&2
  load_public_env .env
fi

if [ -z "${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:-}" ]; then
  echo "error: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is empty." >&2
  echo "       RainbowKit throws during prerendering without it and the build" >&2
  echo "       fails ~90s in. Set it in build-inputs.env." >&2
  exit 1
fi

if ! git diff --quiet "$SOURCE_COMMIT" -- . 2>/dev/null; then
  echo "note: working tree differs from $COMMIT_ISH; building the commit, not your tree" >&2
fi

mkdir -p dist
rm -rf "$OUT_DIR"

git archive --format=tar "$SOURCE_COMMIT" | docker build \
  --file Dockerfile.reproducible \
  --target artifacts \
  ${DOCKER_NO_CACHE:+--no-cache} \
  --build-arg SOURCE_COMMIT="$SOURCE_COMMIT" \
  --build-arg NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:-}" \
  --build-arg NEXT_PUBLIC_INFURA_ID="${NEXT_PUBLIC_INFURA_ID:-}" \
  --build-arg NEXT_PUBLIC_NOTES_SIGNER_ADDRESS="${NEXT_PUBLIC_NOTES_SIGNER_ADDRESS:-}" \
  --build-arg NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL="${NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL:-}" \
  --output "type=local,dest=$OUT_DIR" \
  -

node scripts/hash-build.mjs "$OUT_DIR" --commit "$SOURCE_COMMIT" --out "$MANIFEST"
