#!/usr/bin/env node
// Builds a condensed Version Packages PR body from the release branch's
// CHANGELOG.md diffs. changesets/action@v1 drops every changelog entry once the
// full body passes its own 60,000-character cap, which leaves the release PR
// with bare package headings. This keeps the action's header and lists one
// trimmed bullet per entry, linking each package's full CHANGELOG.md.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** changesets/action@v1 MAX_CHARACTERS_PER_MESSAGE; GitHub's hard cap is 65,536. */
export const BODY_LIMIT = 60000;

const DEFAULT_HEADER = 'This PR was opened by the [Changesets release](https://github.com/changesets/action) GitHub action.\n';
const RELEASES_HEADING = '# Releases';
const BULLET_LENGTHS = [Infinity, 240, 160, 100, 60];
const PACKAGE_CAPS = [Infinity, 25, 12, 6, 3, 1, 0];

function firstSentence(line) {
  const text = line.replace(/^[0-9a-f]{7,40}: /, '').trim();
  const match = /^(.+?[.!?])(?=\s|$)/.exec(text);
  return match ? match[1] : text;
}

/**
 * Parses a unified `git diff` of CHANGELOG.md files into released packages.
 * @param {string} diffText unified diff output
 * @returns {{ name: string, path: string, version: string, entries: string[] }[]}
 */
export function parseChangelogDiff(diffText) {
  const packages = [];
  const files = diffText.split(/^diff --git /m).slice(1);
  for (const file of files) {
    const pathMatch = /^a\/\S+ b\/(\S+)/.exec(file);
    if (!pathMatch || !pathMatch[1].endsWith('CHANGELOG.md')) continue;
    const path = pathMatch[1];
    const lines = file.split('\n');
    const titleLine = lines.find((line) => /^[ +]# \S/.test(line));
    const name = titleLine ? titleLine.slice(3).trim() : path.replace(/\/CHANGELOG\.md$/, '');
    const added = lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).map((line) => line.slice(1));
    const versionIndex = added.findIndex((line) => line.startsWith('## '));
    if (versionIndex === -1) continue;
    const version = added[versionIndex].slice(3).trim();
    const entries = [];
    let dependencyUpdates = 0;
    for (const line of added.slice(versionIndex + 1)) {
      if (line.startsWith('## ')) break;
      if (line.startsWith('- Updated dependencies')) dependencyUpdates += 1;
      else if (line.startsWith('- ')) entries.push(firstSentence(line.slice(2)));
    }
    if (dependencyUpdates > 0) {
      entries.push(`Updated dependencies (${dependencyUpdates} ${dependencyUpdates === 1 ? 'entry' : 'entries'})`);
    }
    packages.push({ name, path, version, entries });
  }
  return packages;
}

/**
 * Returns the changesets header from an existing PR body (text before `# Releases`).
 * @param {string} body current PR body
 * @returns {string}
 */
export function extractHeader(body) {
  const index = body.indexOf(`\n${RELEASES_HEADING}`);
  const header = index === -1 ? '' : body.slice(0, index).trimEnd();
  return header ? `${header}\n` : DEFAULT_HEADER;
}

function trimBullet(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function renderBody({ header, packages, repo, branch }, bulletLength, packageCap) {
  const sections = packages.map((pkg) => {
    const shown = pkg.entries.slice(0, packageCap).map((entry) => `- ${trimBullet(entry, bulletLength)}`);
    const hidden = pkg.entries.length - shown.length;
    if (hidden > 0) shown.push(`- …and ${hidden} more`);
    const link = `[Full changelog](https://github.com/${repo}/blob/${branch}/${pkg.path})`;
    return [`## ${pkg.name}@${pkg.version}`, '', ...shown, ...(shown.length ? [''] : []), link].join('\n');
  });
  const note = '> Condensed by `scripts/release-pr-body.mjs`: the first sentence of each changelog entry. Each package links its full CHANGELOG.md.';
  return [header, RELEASES_HEADING, '', note, '', sections.join('\n\n'), ''].join('\n');
}

/**
 * Builds the condensed body, shortening bullets and then capping entries per
 * package until it fits under `limit`.
 * @param {{ header: string, packages: ReturnType<typeof parseChangelogDiff>, repo: string, branch: string, limit?: number }} options
 * @returns {string}
 */
export function buildReleaseBody(options) {
  const limit = options.limit ?? BODY_LIMIT;
  let body = '';
  for (const packageCap of PACKAGE_CAPS) {
    for (const bulletLength of BULLET_LENGTHS) {
      body = renderBody(options, bulletLength, packageCap);
      if (body.length <= limit) return body;
    }
  }
  return body.slice(0, limit);
}

function parseArgs(argv) {
  const args = { branch: 'changeset-release/main' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') args.base = argv[++index];
    else if (arg === '--head') args.head = argv[++index];
    else if (arg === '--repo') args.repo = argv[++index];
    else if (arg === '--branch') args.branch = argv[++index];
    else if (arg === '--pr') args.pr = argv[++index];
    else if (arg === '--diff-file') args.diffFile = argv[++index];
    else if (arg === '--header-file') args.headerFile = argv[++index];
    else if (arg === '--out') args.out = argv[++index];
    else if (arg === '--apply') args.apply = true;
  }
  return args;
}

function readInputs(args) {
  const diffText = args.diffFile
    ? readFileSync(args.diffFile, 'utf8')
    : execFileSync('git', ['diff', `${args.base}...${args.head}`, '--', '*CHANGELOG.md'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let currentBody = '';
  if (args.headerFile) currentBody = readFileSync(args.headerFile, 'utf8');
  else if (args.pr) currentBody = execFileSync('gh', ['pr', 'view', args.pr, '--repo', args.repo, '--json', 'body', '-q', '.body'], { encoding: 'utf8' });
  return { diffText, currentBody };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.repo) throw new Error('--repo owner/name is required');
  const { diffText, currentBody } = readInputs(args);
  if (currentBody && !currentBody.includes('omitted from this message')) {
    console.log('The changesets body still carries its changelog; leaving it unchanged.');
    return;
  }
  const packages = parseChangelogDiff(diffText);
  if (packages.length === 0) {
    console.log('No released CHANGELOG.md entries found; leaving the PR body unchanged.');
    return;
  }
  const body = buildReleaseBody({ header: extractHeader(currentBody), packages, repo: args.repo, branch: args.branch });
  const out = args.out ?? 'release-pr-body.md';
  writeFileSync(out, body);
  console.log(`Wrote ${body.length} characters for ${packages.length} packages to ${out}.`);
  if (!args.apply) return;
  if (!args.pr) throw new Error('--apply needs --pr');
  execFileSync('gh', ['pr', 'edit', args.pr, '--repo', args.repo, '--body-file', out], { stdio: 'inherit' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
