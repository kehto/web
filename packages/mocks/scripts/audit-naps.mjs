#!/usr/bin/env node
/**
 * audit-naps.mjs — Compare the spec refs recorded in `src/domains/*.ts`
 * against the live `napplet/naps` repository (master plus every open PR).
 *
 * Usage:
 *   node scripts/audit-naps.mjs            # human report
 *   node scripts/audit-naps.mjs --json     # machine report
 *   node scripts/audit-naps.mjs --strict   # exit 1 when anything is stale/retired/missing
 *
 * `scripts/deferred-naps.json` lists upstream drafts Kehto deliberately does
 * not mock yet, pinned to a PR number and head sha with a one-line reason.
 * A missing document matching an entry exactly is reported as `deferred` and
 * does not fail `--strict`. When the head moves the document is `missing`
 * again, so the deferral is re-reviewed; an entry whose PR closed or that a
 * mock now covers is `retired`, so the list stays honest.
 *
 * Requires the GitHub CLI (`gh`) with read access to napplet/naps. The pure
 * helpers are exported so unit tests can run without network access.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/**
 * Read the deferred-draft list. A missing file means nothing is deferred.
 * @param {string} file
 * @returns {Array<{ nap: string, path: string, pr: number, sha: string, reason: string }>}
 */
export function loadDeferred(file) {
  if (!existsSync(file)) return [];
  const entries = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(entries)) throw new TypeError(`${file} must be a JSON array`);
  for (const entry of entries) {
    const valid = entry && typeof entry.nap === 'string' && NAP_PATH.test(entry.path) && Number.isInteger(entry.pr)
      && /^[0-9a-f]{12,40}$/.test(entry.sha) && typeof entry.reason === 'string' && entry.reason.length > 0;
    if (!valid) throw new TypeError(`invalid deferred entry in ${file}: ${JSON.stringify(entry)}`);
  }
  return entries;
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
 * @param {ReturnType<typeof loadDeferred>} [deferredList]
 */
export function compareRefs(refs, upstream, deferredList = []) {
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
  const deferred = [];
  const stillMissing = [];
  for (const item of missing) {
    const entry = item.source === 'pr' ? deferredList.find((candidate) => candidate.pr === item.pr && candidate.path === item.path) : undefined;
    if (entry && shaMatches(entry.sha, item.sha)) deferred.push({ ...item, reason: entry.reason });
    else stillMissing.push(entry ? { ...item, deferredAt: entry.sha } : item);
  }
  for (const entry of deferredList) {
    const ref = { nap: entry.nap, status: 'draft', source: 'pr', pr: entry.pr, sha: entry.sha, path: entry.path };
    const pull = upstream.pulls.find((item) => item.number === entry.pr);
    if (!pull) retired.push({ ref, reason: `deferred PR #${entry.pr} is not open; drop it from deferred-naps.json` });
    else if (covered.has(entry.path)) retired.push({ ref, reason: 'deferred document is now mocked; drop it from deferred-naps.json' });
  }
  return { current, stale, retired, missing: stillMissing, deferred };
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
  const where = (item) => `${item.path} ${item.source === 'pr' ? `PR #${item.pr}${item.draft ? ' (draft)' : ''}` : 'master'} @ ${item.sha.slice(0, 12)}`;
  row('missing', report.missing, (item) => `${where(item)}${item.title ? ` — ${item.title}` : ''}${item.deferredAt ? ` (deferred at ${item.deferredAt}; head moved, re-review)` : ''}`);
  row('deferred', report.deferred ?? [], (item) => `${where(item)} — ${item.reason}`);
  return lines.join('\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  const here = dirname(fileURLToPath(import.meta.url));
  const refs = collectSpecRefs(join(here, '..', 'src', 'domains'));
  const upstream = fetchUpstream();
  const report = compareRefs(refs, upstream, loadDeferred(join(here, 'deferred-naps.json')));
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
