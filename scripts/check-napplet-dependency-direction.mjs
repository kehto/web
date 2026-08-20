#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const MANIFEST_SECTIONS = [
  ['dependencies', (manifest) => manifest.dependencies],
  ['devDependencies', (manifest) => manifest.devDependencies],
  ['peerDependencies', (manifest) => manifest.peerDependencies],
  ['pnpm.overrides', (manifest) => manifest.pnpm?.overrides],
];

function readArg(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function runGit(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}

function changedManifestPaths(base, head) {
  return runGit(['diff', '--name-only', '--diff-filter=ACMR', `${base}...${head}`])
    .split('\n')
    .filter((path) => path === 'package.json' || path.endsWith('/package.json'));
}

function manifestAt(revision, path) {
  try {
    return JSON.parse(runGit(['show', `${revision}:${path}`]));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`could not parse ${revision}:${path}: ${detail}`);
  }
}

function manifestExistsAt(revision, path) {
  return runGit(['ls-tree', '--name-only', revision, '--', path]).trim() === path;
}

function parseVersion(specifier) {
  if (typeof specifier !== 'string') return null;
  const match = specifier.match(/(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function compareVersions(left, right) {
  for (const field of ['major', 'minor', 'patch']) {
    if (left[field] !== right[field]) return left[field] > right[field] ? 1 : -1;
  }
  if (left.prerelease === right.prerelease) return 0;
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;
  return left.prerelease.localeCompare(right.prerelease);
}

function nappletEntries(manifest, section) {
  const entries = section(manifest) ?? {};
  return Object.entries(entries).filter(([name]) => name.startsWith('@napplet/'));
}

function validateManifest(path, baseManifest, headManifest) {
  const violations = [];
  for (const [sectionName, section] of MANIFEST_SECTIONS) {
    const baseEntries = new Map(nappletEntries(baseManifest, section));
    const headEntries = new Map(nappletEntries(headManifest, section));
    for (const [name, baseSpecifier] of baseEntries) {
      const headSpecifier = headEntries.get(name);
      const label = `${path} ${sectionName}.${name}`;
      if (headSpecifier === undefined) {
        violations.push(`${label} was removed`);
        continue;
      }
      if (baseSpecifier === headSpecifier) continue;
      const baseVersion = parseVersion(baseSpecifier);
      const headVersion = parseVersion(headSpecifier);
      if (!baseVersion || !headVersion) {
        violations.push(`${label} changed from ${baseSpecifier} to ${headSpecifier} without a comparable semver version`);
        continue;
      }
      if (compareVersions(headVersion, baseVersion) < 0) {
        violations.push(`${label} decreased from ${baseSpecifier} to ${headSpecifier}`);
      }
    }
  }
  return violations;
}

function main() {
  const base = readArg('--base') ?? process.env.BASE_SHA;
  const head = readArg('--head') ?? process.env.HEAD_SHA ?? 'HEAD';
  if (!base) {
    console.error('Usage: node scripts/check-napplet-dependency-direction.mjs --base <sha> [--head <sha>]');
    process.exit(2);
  }

  const violations = [];
  try {
    for (const path of changedManifestPaths(base, head)) {
      const headManifest = manifestAt(head, path);
      if (!manifestExistsAt(base, path)) continue;
      violations.push(...validateManifest(path, manifestAt(base, path), headManifest));
    }
  } catch (error) {
    console.error(`Napplet dependency direction check failed closed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (violations.length > 0) {
    console.error('Napplet dependency direction check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }

  console.log('Napplet dependency direction check passed.');
}

main();
