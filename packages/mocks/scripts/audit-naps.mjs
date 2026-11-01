#!/usr/bin/env node
/**
 * audit-naps.mjs — Compare the spec refs recorded in `src/domains/*.ts`
 * against the live `napplet/naps` repository (master plus every open PR).
 *
 * Usage:
 *   node scripts/audit-naps.mjs            # human report
 *   node scripts/audit-naps.mjs --json     # machine report
 *   node scripts/audit-naps.mjs --strict   # exit 1 when anything is stale/missing
 *
 * Requires the GitHub CLI (`gh`) with read access to napplet/naps. The pure
 * helpers are exported so unit tests can run without network access.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'napplet/naps';
const NAP_PATH = /^naps\/NAP-[A-Z0-9-]+\.md$/;

/**
 * Extract every `*_SPEC_REF` literal from a TypeScript source string.
 * @param {string} source
 * @returns {Array<{ nap: string, status: string, source: string, pr?: number, sha: string, path: string }>}
 */
export function parseSpecRefs(source) {
  const refs = [];
  const literal = /_SPEC_REF\s*:\s*NapSpecRef\s*=\s*(?:Object\.freeze\()?\{([^}]*)\}/g;
  let match;
  while ((match = literal.exec(source)) !== null) {
    const body = match[1];
    const field = (name) => {
      const found = new RegExp(`\\b${name}\\s*:\\s*'([^']*)'`).exec(body);
      return found ? found[1] : undefined;
    };
    const pr = /\bpr\s*:\s*(\d+)/.exec(body);
    const nap = field('nap');
    const sha = field('sha');
    const path = field('path');
    if (!nap || !sha || !path) continue;
    refs.push({
      nap,
      status: field('status') ?? 'draft',
      source: field('source') ?? (pr ? 'pr' : 'master'),
      ...(pr ? { pr: Number(pr[1]) } : {}),
      sha,
      path,
    });
  }
  return refs;
}

/**
 * Read every non-test domain module and collect its spec refs.
 * @param {string} domainsDir
 */
export function collectSpecRefs(domainsDir) {
  const refs = [];
  for (const name of readdirSync(domainsDir).sort()) {
    if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
    refs.push(...parseSpecRefs(readFileSync(join(domainsDir, name), 'utf8')));
  }
  return refs;
}

function gh(args, exec) {
  return exec('gh', args);
}

/**
 * Fetch the live NAP document inventory: master docs and open-PR docs.
 * @param {{ exec?: (cmd: string, args: string[]) => string }} [options]
 * @returns {{ master: { sha: string, docs: string[] }, pulls: Array<{ number: number, sha: string, draft: boolean, title: string, docs: string[] }> }}
 */
export function fetchUpstream(options = {}) {
  const exec = options.exec ?? ((cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }));
  const masterSha = JSON.parse(gh(['api', `repos/${REPO}/commits/master`, '--jq', '{sha: .sha}'], exec)).sha;
  const masterDocs = JSON.parse(gh(['api', `repos/${REPO}/contents/naps?ref=master`], exec))
    .map((entry) => entry.path)
    .filter((path) => NAP_PATH.test(path));
  const pulls = JSON.parse(gh(['pr', 'list', '-R', REPO, '--state', 'open', '--limit', '200', '--json', 'number,headRefOid,isDraft,title'], exec));
  const result = [];
  for (const pull of pulls) {
    const files = JSON.parse(gh(['api', `repos/${REPO}/pulls/${pull.number}/files`, '--paginate', '--jq', '[.[] | {filename, status}]'], exec));
    const docs = (Array.isArray(files) ? files : []).filter((file) => NAP_PATH.test(file.filename) && file.status !== 'removed').map((file) => file.filename);
    result.push({ number: pull.number, sha: pull.headRefOid, draft: pull.isDraft, title: pull.title, docs });
  }
  return { master: { sha: masterSha, docs: masterDocs }, pulls: result };
}

function shaMatches(recorded, live) {
  return live.startsWith(recorded) || recorded.startsWith(live);
}

/**
 * Compare recorded refs with the live inventory.
 * @param {ReturnType<typeof collectSpecRefs>} refs
 * @param {ReturnType<typeof fetchUpstream>} upstream
 */
export function compareRefs(refs, upstream) {
  const current = [];
  const stale = [];
  const retired = [];
  const covered = new Set();

  for (const ref of refs) {
    if (ref.source === 'master') {
      if (!upstream.master.docs.includes(ref.path)) {
        retired.push({ ref, reason: 'document no longer on master' });
        continue;
      }
      covered.add(ref.path);
      (shaMatches(ref.sha, upstream.master.sha) ? current : stale).push({ ref, liveSha: upstream.master.sha });
      continue;
    }
    const pull = upstream.pulls.find((item) => item.number === ref.pr);
    if (!pull) {
      const onMaster = upstream.master.docs.includes(ref.path);
      retired.push({ ref, reason: onMaster ? `PR #${ref.pr} closed; document is on master` : `PR #${ref.pr} is not open` });
      if (onMaster) covered.add(ref.path);
      continue;
    }
    covered.add(`${ref.path}#${pull.number}`);
    covered.add(ref.path);
    (shaMatches(ref.sha, pull.sha) ? current : stale).push({ ref, liveSha: pull.sha, title: pull.title });
  }

  const missing = [];
  for (const path of upstream.master.docs) {
    if (!covered.has(path)) missing.push({ path, source: 'master', sha: upstream.master.sha });
  }
  for (const pull of upstream.pulls) {
    for (const path of pull.docs) {
      const isNewDoc = !upstream.master.docs.includes(path);
      if (isNewDoc && !covered.has(`${path}#${pull.number}`) && !covered.has(path)) {
        missing.push({ path, source: 'pr', pr: pull.number, sha: pull.sha, title: pull.title, draft: pull.draft });
      }
    }
  }
  return { current, stale, retired, missing };
}

/**
 * Render a comparison as text.
 * @param {ReturnType<typeof compareRefs>} report
 */
export function formatReport(report) {
  const lines = [];
  const row = (label, items, render) => {
    lines.push(`${label} (${items.length})`);
    for (const item of items) lines.push(`  - ${render(item)}`);
  };
  row('current', report.current, ({ ref }) => `${ref.nap} ${ref.source === 'pr' ? `PR #${ref.pr}` : 'master'} @ ${ref.sha}`);
  row('stale', report.stale, ({ ref, liveSha, title }) => `${ref.nap} ${ref.source === 'pr' ? `PR #${ref.pr}` : 'master'} recorded ${ref.sha}, live ${liveSha.slice(0, 12)}${title ? ` — ${title}` : ''}`);
  row('retired', report.retired, ({ ref, reason }) => `${ref.nap} ${ref.source === 'pr' ? `PR #${ref.pr}` : 'master'} — ${reason}`);
  row('missing', report.missing, (item) => `${item.path} ${item.source === 'pr' ? `PR #${item.pr}${item.draft ? ' (draft)' : ''}` : 'master'} @ ${item.sha.slice(0, 12)}${item.title ? ` — ${item.title}` : ''}`);
  return lines.join('\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  const here = dirname(fileURLToPath(import.meta.url));
  const refs = collectSpecRefs(join(here, '..', 'src', 'domains'));
  const upstream = fetchUpstream();
  const report = compareRefs(refs, upstream);
  if (args.has('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }
  const actionable = report.stale.length + report.retired.length + report.missing.length;
  if (args.has('--strict') && actionable > 0) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
