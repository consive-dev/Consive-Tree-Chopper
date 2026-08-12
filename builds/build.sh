#!/usr/bin/env sh
# Build script to package behavior_pack into a .mcaddon (zip)
set -e
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"
BUILD_DIR="$PROJECT_ROOT/builds"
OUT="$BUILD_DIR/TreeChopper.mcaddon"
HASH_FILE="$BUILD_DIR/.behavior_pack_hash"

mkdir -p "$BUILD_DIR"

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

compute_behavior_hash() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$PROJECT_ROOT/behavior_pack" <<'PY'
import hashlib, json, os, sys
root = sys.argv[1]
ignore_name = 'manifest.json'
h = hashlib.sha256()
for dirpath, dirnames, filenames in os.walk(root):
    dirnames.sort()
    for fname in sorted(filenames):
        path = os.path.join(dirpath, fname)
        rel = os.path.relpath(path, root).replace(os.sep, '/')
        h.update(rel.encode('utf-8'))
        if fname == ignore_name:
            try:
                data = json.load(open(path, 'r', encoding='utf-8'))
            except Exception:
                with open(path, 'rb') as fh:
                    h.update(fh.read())
                    continue
            def normalize(obj):
                if isinstance(obj, dict):
                    return {k: normalize(v) for k, v in obj.items()}
                if isinstance(obj, list) and len(obj) == 3 and all(isinstance(x, int) for x in obj):
                    return [0, 0, 0]
                return [normalize(x) for x in obj] if isinstance(obj, list) else obj
            normalized = normalize(data)
            h.update(json.dumps(normalized, sort_keys=True, separators=(',', ':')).encode('utf-8'))
        else:
            with open(path, 'rb') as fh:
                h.update(fh.read())
print(h.hexdigest())
PY
  elif command -v python >/dev/null 2>&1; then
    python - "$PROJECT_ROOT/behavior_pack" <<'PY'
import hashlib, json, os, sys
root = sys.argv[1]
ignore_name = 'manifest.json'
h = hashlib.sha256()
for dirpath, dirnames, filenames in os.walk(root):
    dirnames.sort()
    for fname in sorted(filenames):
        path = os.path.join(dirpath, fname)
        rel = os.path.relpath(path, root).replace(os.sep, '/')
        h.update(rel.encode('utf-8'))
        if fname == ignore_name:
            try:
                data = json.load(open(path, 'r', encoding='utf-8'))
            except Exception:
                with open(path, 'rb') as fh:
                    h.update(fh.read())
                    continue
            def normalize(obj):
                if isinstance(obj, dict):
                    return {k: normalize(v) for k, v in obj.items()}
                if isinstance(obj, list) and len(obj) == 3 and all(isinstance(x, int) for x in obj):
                    return [0, 0, 0]
                return [normalize(x) for x in obj] if isinstance(obj, list) else obj
            normalized = normalize(data)
            h.update(json.dumps(normalized, sort_keys=True, separators=(',', ':')).encode('utf-8'))
        else:
            with open(path, 'rb') as fh:
                h.update(fh.read())
print(h.hexdigest())
PY
  else
    find behavior_pack -type f | sort | xargs sha256sum | sha256sum | awk '{print $1}'
  fi
}

should_bump_manifest=false
current_hash=$(compute_behavior_hash)
if [ -f "$HASH_FILE" ]; then
  previous_hash=$(cat "$HASH_FILE")
  if [ "$current_hash" != "$previous_hash" ]; then
    should_bump_manifest=true
  fi
else
  if git diff --quiet -- behavior_pack && git diff --cached --quiet -- behavior_pack; then
    should_bump_manifest=false
  else
    should_bump_manifest=true
  fi
fi

if [ "$should_bump_manifest" = true ]; then
  echo "Behavior pack changed since last build; bumping manifest version..."
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
else
  echo "Behavior pack unchanged since last build; skipping manifest bump."
fi

# Zip the contents of behavior_pack into .mcaddon (pack root should be at archive root)
cd "$PROJECT_ROOT/behavior_pack"
zip -r "$OUT" . -x "*.DS_Store" >/dev/null
cd "$PROJECT_ROOT"

# Store current behavior_pack hash for next build; recompute after any manifest bump to normalize version changes
final_hash=$(compute_behavior_hash)
printf '%s' "$final_hash" > "$HASH_FILE"

version=$(get_manifest_version 2>/dev/null || true)
echo "Created $OUT"
if [ -n "$version" ]; then
  echo "Pack version: $version"
fi
