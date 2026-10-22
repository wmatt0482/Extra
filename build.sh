#!/usr/bin/env bash
# Assembles the learninglab.fun deploy in dist/ (no dependencies, no network):
#   site/          -> dist/               (home page, /why/)
#   car-jump/      -> dist/spell-jump/    (the Spell Jump game, minus dev-only files)
#   trail-blazer/  -> dist/trail-blazer/  (the Trail Blazer game, same excludes; it imports a few Spell Jump modules
#                                          from /spell-jump/ at runtime)
# The repo-root `spell-jump -> car-jump` symlink is for local dev servers only: it is never followed or copied here.
# Netlify runs this as the build command (netlify.toml); run it locally the same way: bash build.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$root/dist"
game_exclude=(tools docs package.json dev.html SPEC.md)

rm -rf "$out"
mkdir -p "$out"

cp -R "$root/site/." "$out/"

shopt -s dotglob nullglob
# copy_game <source folder> <dist folder>: everything but the dev-only files
copy_game() {
  local src="$1" dest="$2"
  mkdir -p "$dest"
  for path in "$src/"*; do
    name="$(basename "$path")"
    skip=0
    for ex in "${game_exclude[@]}"; do [[ "$name" == "$ex" ]] && skip=1 && break; done
    [[ "$name" == "node_modules" || "$name" == ".DS_Store" ]] && skip=1
    (( skip )) || cp -R "$path" "$dest/"
  done
}
copy_game "$root/car-jump" "$out/spell-jump"
copy_game "$root/trail-blazer" "$out/trail-blazer"

for required in index.html why/index.html stats/index.html spell-jump/index.html spell-jump/sw.js spell-jump/manifest.webmanifest spell-jump/icons/favicon.png \
    trail-blazer/index.html trail-blazer/sw.js trail-blazer/manifest.webmanifest trail-blazer/icons/favicon.png; do
  [[ -f "$out/$required" ]] || { echo "build.sh: missing dist/$required" >&2; exit 1; }
done

echo "build.sh: dist/ ready ($(find "$out" -type f | wc -l | tr -d ' ') files)"
