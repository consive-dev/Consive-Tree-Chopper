#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const projectRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8"
}).trim();

const manifestPaths = findPackManifestPaths(projectRoot);

if (manifestPaths.length === 0) {
  console.error("No pack manifest.json files were found.");
  process.exit(1);
}

const manifests = manifestPaths.map((manifestPath) => ({
  path: manifestPath,
  content: JSON.parse(fs.readFileSync(manifestPath, "utf8"))
}));

const nextVersion = increasePatch(getHighestVersion(manifests));

for (const manifest of manifests) {
  manifest.content.header.version = nextVersion;

  for (const module of manifest.content.modules ?? []) {
    module.version = nextVersion;
  }

  for (const dependency of manifest.content.dependencies ?? []) {
    if (dependency.uuid) {
      dependency.version = nextVersion;
    }
  }

  fs.writeFileSync(manifest.path, `${JSON.stringify(manifest.content, null, 2)}\n`);
  console.log(`${path.relative(projectRoot, manifest.path)} -> ${nextVersion.join(".")}`);
}

function getHighestVersion(manifests) {
  return manifests
    .map(({ content }) => content.header?.version)
    .reduce((highest, version) => {
      validateVersion(version);
      return compareVersions(version, highest) > 0 ? version : highest;
    });
}

function increasePatch(version) {
  return [version[0], version[1], version[2] + 1];
}

function validateVersion(version) {
  if (!Array.isArray(version) || version.length !== 3 || !version.every(Number.isInteger)) {
    throw new Error("Each manifest header.version must be an array like [0, 1, 0].");
  }
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  return 0;
}

function findPackManifestPaths(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_pack"))
    .map((entry) => path.join(directory, entry.name, "manifest.json"))
    .filter((manifestPath) => fs.existsSync(manifestPath));
}
