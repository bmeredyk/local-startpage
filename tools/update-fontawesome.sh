#!/usr/bin/env bash
# Download a Font Awesome Free release, vendor it, and regenerate fa-icons.js.
# Usage: tools/update-fontawesome.sh <version>      e.g. tools/update-fontawesome.sh 6.7.2
set -euo pipefail

version="${1:?usage: tools/update-fontawesome.sh <version>  (e.g. 6.7.2)}"
root="$(cd "$(dirname "$0")/.." && pwd)"
cdn="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${version}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/css" "$tmp/webfonts" "$tmp/metadata"

for f in css/all.min.css webfonts/fa-solid-900.woff2 webfonts/fa-regular-400.woff2 \
         webfonts/fa-brands-400.woff2 webfonts/fa-v4compatibility.woff2 \
         metadata/icons.yml LICENSE.txt; do
  echo "downloading $f"
  curl -fsSL -o "$tmp/$f" "$cdn/$f"
done

# Generate first, so a failure leaves the vendored files untouched.
uv run "$root/tools/gen-fontawesome-icons.py" "$tmp" "$tmp/fa-icons.js"

rm -rf "$root/vendor/fontawesome"
mkdir -p "$root/vendor/fontawesome/css" "$root/vendor/fontawesome/webfonts"
cp "$tmp/css/all.min.css" "$root/vendor/fontawesome/css/"
cp "$tmp/webfonts/"*.woff2 "$root/vendor/fontawesome/webfonts/"
cp "$tmp/LICENSE.txt" "$root/vendor/fontawesome/LICENSE.txt"
cp "$tmp/fa-icons.js" "$root/fa-icons.js"
echo "done: vendor/fontawesome and fa-icons.js are now Font Awesome Free ${version}"
