#!/usr/bin/env bash
# Download a Bootstrap Icons release, vendor it, and regenerate icons.js.
# Usage: tools/update-bootstrap-icons.sh <version>      e.g. tools/update-bootstrap-icons.sh 1.11.3
set -euo pipefail

version="${1:?usage: tools/update-bootstrap-icons.sh <version>  (e.g. 1.11.3)}"
root="$(cd "$(dirname "$0")/.." && pwd)"
cdn="https://cdn.jsdelivr.net/npm/bootstrap-icons@${version}/font"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/fonts"

curl -fsSL -o "$tmp/bootstrap-icons.min.css" "$cdn/bootstrap-icons.min.css"
curl -fsSL -o "$tmp/fonts/bootstrap-icons.woff2" "$cdn/fonts/bootstrap-icons.woff2"
curl -fsSL -o "$tmp/fonts/bootstrap-icons.woff" "$cdn/fonts/bootstrap-icons.woff"

cp "$tmp/bootstrap-icons.min.css" "$root/vendor/bootstrap-icons.min.css"
cp "$tmp/fonts/"* "$root/vendor/fonts/"
node "$root/tools/gen-bootstrap-icons.mjs"
echo "done: vendor/bootstrap-icons.* and icons.js are now Bootstrap Icons ${version}"
