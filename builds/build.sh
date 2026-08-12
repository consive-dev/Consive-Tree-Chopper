#!/usr/bin/env sh
# Build script to package behavior_pack into a .mcaddon (zip)
set -e
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"
BUILD_DIR="$PROJECT_ROOT/builds"
OUT="$BUILD_DIR/TreeChopper.mcaddon"

# Remove old build
[ -f "$OUT" ] && rm -f "$OUT"

get_manifest_version() {
  manifest="$PROJECT_ROOT/behavior_pack/manifest.json"
  if [ ! -f "$manifest" ]; then
    return 1
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); print(".".join(str(x) for x in m["header"]["version"]))' "$manifest"
    return 0
  elif command -v python >/dev/null 2>&1; then
    python -c 'import json,sys; m=json.load(open(sys.argv[1])); print(".".join(str(x) for x in m["header"]["version"]))' "$manifest"
    return 0
  else
    grep -o '"version"[[:space:]]*:[[:space:]]*\[[^]]*\]' "$manifest" | head -n 1 | sed -E 's/.*\[([0-9]+),[[:space:]]*([0-9]+),[[:space:]]*([0-9]+)\].*/\1.\2.\3/'
    return 0
  fi
}

# Ensure manifests are bumped before packaging (try node first, then python)
if command -v node >/dev/null 2>&1; then
  echo "Running manifest bump script with node..."
  node scripts/bump-manifest-versions.js || echo "bump script returned non-zero"
elif command -v python3 >/dev/null 2>&1; then
  echo "Running manifest bump script with python3..."
  python3 scripts/bump-manifest-versions.py || echo "bump script returned non-zero"
elif command -v python >/dev/null 2>&1; then
  echo "Running manifest bump script with python..."
  python scripts/bump-manifest-versions.py || echo "bump script returned non-zero"
else
  echo "No node/python interpreter found; skipping automatic manifest bump. Ensure you bump manifests manually before release."
fi

# Zip behavior_pack into .mcaddon (zip format). Include only the behavior_pack folder.
zip -r "$OUT" behavior_pack -x "*.DS_Store" >/dev/null

version=$(get_manifest_version 2>/dev/null || true)
echo "Created $OUT"
if [ -n "$version" ]; then
  echo "Pack version: $version"
fi
