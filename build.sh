#!/usr/bin/env bash
# Assembles the learninglab.fun deploy in dist/ (no dependencies, no network):
#   site/      -> dist/             (home page, /why/)
#   car-jump/  -> dist/spell-jump/  (the Spell Jump game, minus dev-only files)
# Netlify runs this as the build command (netlify.toml); run it locally the same way: bash build.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$root/dist"
game_exclude=(tools docs package.json dev.html SPEC.md)

rm -rf "$out"
mkdir -p "$out/spell-jump"

cp -R "$root/site/." "$out/"

shopt -s dotglob nullglob
for path in "$root/car-jump/"*; do
  name="$(basename "$path")"
  skip=0
  for ex in "${game_exclude[@]}"; do [[ "$name" == "$ex" ]] && skip=1 && break; done
  [[ "$name" == "node_modules" || "$name" == ".DS_Store" ]] && skip=1
  (( skip )) || cp -R "$path" "$out/spell-jump/"
done

for required in index.html why/index.html spell-jump/index.html spell-jump/sw.js spell-jump/manifest.webmanifest spell-jump/icons/favicon.png; do
  [[ -f "$out/$required" ]] || { echo "build.sh: missing dist/$required" >&2; exit 1; }
done

echo "build.sh: dist/ ready ($(find "$out" -type f | wc -l | tr -d ' ') files)"
