#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const VERSION_METADATA_PATTERNS = [
  /^docs\/packages\/[^/]+\.md$/,
  /^packages\/[^/]+\/CHANGELOG\.md$/,
  /^packages\/[^/]+\/jsr\.json$/,
  /^packages\/[^/]+\/package\.json$/,
];

function parseArgs(argv) {
  const args = {
    format: 'text',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') args.base = argv[++index];
    else if (arg === '--head') args.head = argv[++index];
    else if (arg === '--github-output') args.githubOutput = argv[++index];
    else if (arg === '--json') args.format = 'json';
  }

  return args;
}

function gitDiffRows(base, head) {
  if (!base || !head || /^0+$/.test(base)) return [];

  const output = execFileSync('git', ['diff', '--name-status', `${base}...${head}`], {
    encoding: 'utf8',
  });
  return parseNameStatus(output);
}

export function parseNameStatus(output) {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split('\t');
      return { status, paths };
    });
}

function allPaths(row) {
  return row.paths.filter(Boolean);
}

function isDeletedChangeset(row) {
  return row.status === 'D' && /^\.changeset\/[^/]+\.md$/.test(row.paths[0] ?? '');
}

function isVersionMetadata(row) {
  return allPaths(row).every((path) => VERSION_METADATA_PATTERNS.some((pattern) => pattern.test(path)));
}

function isReleaseIntent(intent = {}) {
  const haystack = [
    intent.prTitle,
    intent.headRef,
    intent.refName,
    intent.commitTitle,
  ]
    .filter(Boolean)
    .join('\n');

  return /(?:^|\n)Version Packages(?:\n|$)|changeset-release\/main|changeset version|version-packages/i.test(haystack);
}

export function classifyCiChanges(rows, intent = {}) {
  if (rows.length === 0) {
    return {
      releaseOnly: false,
      reason: 'no changed files',
      changedFiles: [],
    };
  }

  const changedFiles = rows.flatMap(allPaths);
  const allowedRows = rows.every((row) => isDeletedChangeset(row) || isVersionMetadata(row));
  const hasPackageVersionArtifact = rows.some((row) =>
    allPaths(row).some((path) => /^packages\/[^/]+\/(?:package\.json|jsr\.json|CHANGELOG\.md)$/.test(path)),
  );
  const releaseIntent = isReleaseIntent(intent);

  if (!allowedRows) {
    return {
      releaseOnly: false,
      reason: 'changed files include non-release metadata',
      changedFiles,
    };
  }

  if (!releaseIntent) {
    return {
      releaseOnly: false,
      reason: 'release metadata paths changed outside a Version Packages context',
      changedFiles,
    };
  }

  if (!hasPackageVersionArtifact) {
    return {
      releaseOnly: false,
      reason: 'release intent without package version artifacts',
      changedFiles,
    };
  }

  return {
    releaseOnly: true,
    reason: 'Version Packages metadata only',
    changedFiles,
  };
}

function writeGithubOutput(file, result) {
  const entries = {
    release_only: String(result.releaseOnly),
    reason: result.reason,
    changed_count: String(result.changedFiles.length),
  };

  const body = Object.entries(entries)
    .map(([key, value]) => `${key}=${String(value).replace(/\n/g, ' ')}`)
    .join('\n');
  appendFileSync(file, `${body}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = gitDiffRows(args.base, args.head);
  const result = classifyCiChanges(rows, {
    prTitle: process.env.PR_TITLE,
    headRef: process.env.PR_HEAD_REF,
    refName: process.env.GITHUB_REF_NAME,
    commitTitle: process.env.COMMIT_TITLE,
  });

  if (args.githubOutput) writeGithubOutput(args.githubOutput, result);

  if (args.format === 'json') {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`release_only=${result.releaseOnly}\n`);
  process.stdout.write(`reason=${result.reason}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
