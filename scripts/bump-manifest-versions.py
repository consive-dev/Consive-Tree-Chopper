#!/usr/bin/env python3
import json
import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


def find_pack_manifest_paths(directory):
    paths = []
    for entry in os.listdir(directory):
        entry_path = os.path.join(directory, entry)
        if os.path.isdir(entry_path) and entry.endswith("_pack"):
            manifest_path = os.path.join(entry_path, "manifest.json")
            if os.path.exists(manifest_path):
                paths.append(manifest_path)
    return paths


def validate_version(version):
    if not isinstance(version, list) or len(version) != 3 or not all(isinstance(x, int) for x in version):
        raise ValueError("Each manifest header.version must be an array like [0, 1, 0].")


def compare_versions(left, right):
    for i in range(3):
        if left[i] != right[i]:
            return left[i] - right[i]
    return 0


def increase_patch(version):
    return [version[0], version[1], version[2] + 1]


def get_highest_version(manifests):
    highest = None
    for content in manifests:
        version = content.get("header", {}).get("version")
        validate_version(version)
        if highest is None or compare_versions(version, highest) > 0:
            highest = version
    return highest


def main():
    manifest_paths = find_pack_manifest_paths(PROJECT_ROOT)
    if not manifest_paths:
        print("No pack manifest.json files were found.", file=sys.stderr)
        sys.exit(1)

    manifests = []
    for manifest_path in manifest_paths:
        with open(manifest_path, "r", encoding="utf-8") as fh:
            manifests.append((manifest_path, json.load(fh)))

    next_version = increase_patch(get_highest_version([content for _, content in manifests]))

    for manifest_path, content in manifests:
        content["header"]["version"] = next_version
        for module in content.get("modules", []):
            module["version"] = next_version
        for dependency in content.get("dependencies", []):
            if dependency.get("uuid"):
                dependency["version"] = next_version
        with open(manifest_path, "w", encoding="utf-8") as fh:
            json.dump(content, fh, indent=2)
            fh.write("\n")
        print(f"{os.path.relpath(manifest_path, PROJECT_ROOT)} -> {'.'.join(str(x) for x in next_version)}")


if __name__ == "__main__":
    main()
