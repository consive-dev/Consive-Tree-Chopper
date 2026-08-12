#!/usr/bin/env sh
# Build script to package behavior_pack into a .mcaddon (zip)
set -e
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"
BUILD_DIR="$PROJECT_ROOT/builds"
OUT="$BUILD_DIR/TreeChopper.mcaddon"

# Remove old build
[ -f "$OUT" ] && rm -f "$OUT"

# Ensure manifests are bumped before packaging (if node is available)
if command -v node >/dev/null 2>&1; then
  echo "Running manifest bump script..."
  node scripts/bump-manifest-versions.js || echo "bump script returned non-zero"
else
  echo "node not found; skipping automatic manifest bump. Ensure you bump manifests manually before release."
fi

# Zip behavior_pack into .mcaddon (zip format). Include only the behavior_pack folder.
zip -r "$OUT" behavior_pack -x "*.DS_Store" >/dev/null

echo "Created $OUT"
