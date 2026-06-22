#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function runGitDiff() {
  const base = readArg('--base') ?? process.env.BASE_SHA;
  const head = readArg('--head') ?? process.env.HEAD_SHA ?? 'HEAD';

  if (!base) {
    throw new Error('Missing --base or BASE_SHA');
  }

  return execFileSync('git', ['diff', '--name-status', `${base}...${head}`], {
    encoding: 'utf8',
  });
}

function readDiff() {
  const diffFile = readArg('--diff-file');
  if (diffFile) {
    return readFileSync(diffFile, 'utf8');
  }
  return runGitDiff();
}

function parseRows(diff) {
  return diff
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split('\t');
      return { status, paths };
    });
}

function isChangesetMarkdown(path) {
  return /^\.changeset\/[^/]+\.md$/.test(path);
}

function isPackageManifest(path) {
  return /(^|\/)package\.json$/.test(path);
}

function isPackageChangelog(path) {
  return /(^|\/)CHANGELOG\.md$/.test(path);
}

function isReleaseIntent() {
  const title = process.env.PR_TITLE ?? process.env.COMMIT_TITLE ?? '';
  return /(?:\bchore\(release\):|\brelease:|\bchangeset version\b|\bversion packages\b|\bversion-packages\b)/i.test(
    title,
  );
}

const rows = parseRows(readDiff());
const deletedChangesets = rows
  .filter((row) => row.status === 'D' && isChangesetMarkdown(row.paths[0] ?? ''))
  .map((row) => row.paths[0]);

if (deletedChangesets.length === 0) {
  console.log('No deleted changeset markdown files.');
  process.exit(0);
}

const changedPackageManifests = rows.some((row) =>
  row.paths.some((path) => isPackageManifest(path)),
);
const changedChangelogs = rows.some((row) =>
  row.paths.some((path) => isPackageChangelog(path)),
);

if (isReleaseIntent() && changedPackageManifests && changedChangelogs) {
  console.log(
    `Allowed consumed changesets in release/version PR: ${deletedChangesets.join(', ')}`,
  );
  process.exit(0);
}

console.error('Deleted changeset markdown files are only allowed in release/version PRs.');
console.error('Run `pnpm version-packages` only when preparing a release PR.');
console.error('Deleted files:');
for (const file of deletedChangesets) {
  console.error(`- ${file}`);
}
process.exit(1);
