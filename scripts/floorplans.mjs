#!/usr/bin/env node
/**
 * Per-package Floorplan maps: refresh, freshness check, baseline, and the
 * public GitHub Pages export.
 *
 * Each `@kehto/*` package (and Paja) keeps its map inputs in
 * `packages/<name>/floorplan/`: `architecture.json`, `descriptions/*.json`
 * and `baseline.json` (the last reviewed build, used to detect drift). The
 * generated `graph.json` / `index.html` stay out of git. The Floorplan tool
 * itself is vendored at `tools/floorplan/` (MIT; see VENDORED.md).
 *
 *   node scripts/floorplans.mjs refresh [pkg...]   re-scan, carry renames, flag changed exports
 *   node scripts/floorplans.mjs check   [pkg...]   refresh + report drift (warnings only; --strict exits 1)
 *   node scripts/floorplans.mjs baseline [pkg...]  record the current, fully described build as the baseline
 *   node scripts/floorplans.mjs pages [--out dir]  export every map + an index page, stamped with the commit
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const toolDir = join(repoRoot, 'tools', 'floorplan', 'scripts');
const REPO_URL = 'https://github.com/kehto/web';
const MAX_UNASSIGNED_PERCENT = 2;
const env = { ...process.env, FLOORPLAN_UNATTENDED: '1' };
const rel = (path) => relative(repoRoot, path);

/** @param {string} name @returns {string} */
const mapDirOf = (name) => join(repoRoot, 'packages', name, 'floorplan');

/** Packages that carry a committed map, sorted by name. @returns {string[]} */
function mappedPackages() {
  return readdirSync(join(repoRoot, 'packages'))
    .filter((name) => existsSync(join(mapDirOf(name), 'architecture.json')))
    .sort();
}

/**
 * Run a vendored Floorplan script with `--json` and parse its single JSON result.
 * @param {string} script @param {string[]} args @returns {any}
 */
function runTool(script, args) {
  let out;
  try {
    out = execFileSync(process.execPath, [join(toolDir, script), ...args, '--json'], {
      cwd: repoRoot, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    out = String(error.stdout || '');
  }
  try {
    return JSON.parse(out);
  } catch {
    return { ok: false, errors: [`${script} printed no JSON result`] };
  }
}

/** Restore graph.json from the committed baseline so refresh can diff against it. @param {string} name */
function restoreBaseline(name) {
  const dir = mapDirOf(name);
  const baseline = join(dir, 'baseline.json');
  if (!existsSync(join(dir, 'graph.json')) && existsSync(baseline)) copyFileSync(baseline, join(dir, 'graph.json'));
}

/**
 * Summarise one build result as drift findings.
 * @param {string} name @param {any} build @returns {string[]}
 */
function driftFindings(name, build) {
  if (!build || !build.ok) return [`${name}: build failed: ${(build?.errors || ['unknown error']).join('; ')}`];
  const findings = [];
  const { files, routes, review } = build.descriptions;
  const missing = files.total - files.described + routes.total - routes.described;
  if (missing > 0) findings.push(`${name}: ${missing} file(s) or route(s) have no description`);
  if (review > 0) findings.push(`${name}: ${review} description(s) flagged for review (exports changed)`);
  if (build.files.unassignedPercent > MAX_UNASSIGNED_PERCENT) {
    findings.push(`${name}: ${build.files.unassignedPercent}% of files are not assigned to a part`);
  }
  for (const warning of build.warnings || []) {
    if (/matches no included file|neither a node id nor a scanned file/.test(warning)) findings.push(`${name}: ${warning}`);
  }
  return findings;
}

/**
 * Refresh each package's map in place and return the drift findings.
 * @param {string[]} names @returns {string[]}
 */
function refresh(names) {
  const findings = [];
  for (const name of names) {
    restoreBaseline(name);
    const result = existsSync(join(mapDirOf(name), 'graph.json'))
      ? runTool('refresh.mjs', [rel(join(repoRoot, 'packages', name))])
      : { build: buildOnce(name) };
    findings.push(...driftFindings(name, result.build));
    const counts = result.changes?.descriptions;
    const changed = counts ? ` (${counts.carried ?? 0} carried, ${counts.removed ?? 0} removed, ${counts.flagged ?? 0} flagged)` : '';
    console.log(`[floorplans] ${name}: refreshed${changed}`);
  }
  return findings;
}

/** Scan and build one package without touching descriptions. @param {string} name @returns {any} */
function buildOnce(name) {
  const root = rel(join(repoRoot, 'packages', name));
  const scan = runTool('scan.mjs', [root]);
  if (!scan.ok) return scan;
  return runTool('build.mjs', [root]);
}

/** @param {string[]} findings @param {boolean} strict */
function reportDrift(findings, strict) {
  if (findings.length === 0) {
    console.log('[floorplans] OK - every map is fully described and matches the code structure');
    return;
  }
  for (const finding of findings) {
    console.log(process.env.GITHUB_ACTIONS ? `::warning title=Floorplan drift::${finding}` : `[floorplans] drift: ${finding}`);
  }
  console.log('[floorplans] Refresh with the floorplan skill (tools/floorplan/SKILL.md), then run: node scripts/floorplans.mjs baseline');
  if (strict) process.exitCode = 1;
}

/**
 * Write baseline.json from the current graph.json, refusing incomplete maps.
 * @param {string[]} names
 */
function writeBaselines(names) {
  for (const name of names) {
    const build = buildOnce(name);
    const findings = driftFindings(name, build);
    if (findings.length > 0) {
      for (const finding of findings) console.error(`[floorplans] ${finding}`);
      throw new Error(`${name}: finish the map before recording a baseline`);
    }
    const graph = JSON.parse(readFileSync(join(mapDirOf(name), 'graph.json'), 'utf8'));
    graph.meta = { ...graph.meta, root: null };
    writeFileSync(join(mapDirOf(name), 'baseline.json'), `${JSON.stringify(graph)}\n`);
    console.log(`[floorplans] ${name}: baseline recorded`);
  }
}

/** @param {string} text @returns {string} */
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The commit the published maps were built from. @returns {{ sha: string, short: string, url: string }} */
function commitInfo() {
  let sha = process.env.GITHUB_SHA || '';
  if (!sha) {
    try {
      sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    } catch {
      sha = 'unknown';
    }
  }
  return { sha, short: sha.slice(0, 7), url: `${REPO_URL}/commit/${sha}` };
}

/**
 * Coverage line shown on every published page.
 * @param {any} build @returns {string}
 */
function coverageText(build) {
  const { files, review } = build.descriptions;
  const reviewText = review > 0 ? ` · ${review} awaiting review` : '';
  return `${files.described}/${files.total} files described${reviewText}`;
}

/**
 * Static stamp injected into each exported map (no script, so the export's CSP holds).
 * @param {{ short: string, url: string }} commit @param {string} builtAt @param {any} build @returns {string}
 */
function stampHtml(commit, builtAt, build) {
  const style = 'position:fixed;left:12px;bottom:12px;z-index:2147483000;font:12px/1.4 system-ui,sans-serif;'
    + 'background:rgba(20,20,24,.88);color:#e8e8ec;padding:6px 10px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.3)';
  const link = 'color:#9fd0ff';
  return `<div data-kehto-floorplan-stamp style="${style}">`
    + `<a style="${link}" href="../">All floorplans</a> · generated at `
    + `<a style="${link}" href="${escapeHtml(commit.url)}"><code>${escapeHtml(commit.short)}</code></a>`
    + ` · ${escapeHtml(builtAt.slice(0, 10))} · ${escapeHtml(coverageText(build))}</div>`;
}

/**
 * The /floorplans/ index page linking every package map.
 * @param {{ name: string, title: string, summary: string, coverage: string }[]} entries
 * @param {{ short: string, url: string }} commit @param {string} builtAt @returns {string}
 */
function indexHtml(entries, commit, builtAt) {
  const items = entries.map((entry) => `      <li><a href="${escapeHtml(entry.name)}/"><strong>@kehto/${escapeHtml(entry.name)}</strong></a>`
    + ` <span class="coverage">${escapeHtml(entry.coverage)}</span><p>${escapeHtml(entry.summary)}</p></li>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Kehto floorplans</title>
  <style>
    body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #0f0f12; color: #e8e8ec; }
    main { max-width: 860px; margin: 0 auto; padding: 48px 24px; }
    a { color: #9fd0ff; }
    ul { list-style: none; padding: 0; }
    li { border-top: 1px solid #2a2a32; padding: 16px 0; }
    li p { margin: 4px 0 0; color: #b4b4be; font-size: 14px; }
    .coverage, .stamp { color: #8a8a96; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <p><a href="../">← Kehto web</a></p>
    <h1>Floorplans</h1>
    <p>Interactive architecture maps of each Kehto package: every module and file with a plain name and a one-line description, and how they connect.</p>
    <p class="stamp">Generated at <a href="${escapeHtml(commit.url)}"><code>${escapeHtml(commit.short)}</code></a> on ${escapeHtml(builtAt.slice(0, 10))}. Descriptions are refreshed weekly, so they can lag the code by a few days.</p>
    <ul>
${items}
    </ul>
  </main>
</body>
</html>
`;
}

/**
 * Export every package map plus the index into outDir.
 * @param {string} outDir
 */
function buildPages(outDir) {
  const commit = commitInfo();
  const builtAt = new Date().toISOString();
  const entries = [];
  mkdirSync(outDir, { recursive: true });
  for (const name of mappedPackages()) {
    const build = buildOnce(name);
    if (!build.ok) throw new Error(`${name}: floorplan build failed: ${(build.errors || []).join('; ')}`);
    const pageDir = join(outDir, name);
    mkdirSync(pageDir, { recursive: true });
    const pagePath = join(pageDir, 'index.html');
    execFileSync(process.execPath, [join(mapDirOf(name), 'serve.mjs'), '--export', pagePath, '--include', 'flows,notes'], {
      cwd: repoRoot, env, stdio: ['ignore', 'ignore', 'inherit'],
    });
    const html = readFileSync(pagePath, 'utf8');
    writeFileSync(pagePath, html.replace('</body>', `${stampHtml(commit, builtAt, build)}\n</body>`));
    const arch = JSON.parse(readFileSync(join(mapDirOf(name), 'architecture.json'), 'utf8'));
    entries.push({ name, title: arch.project?.name || name, summary: arch.project?.summary || '', coverage: coverageText(build) });
  }
  writeFileSync(join(outDir, 'index.html'), indexHtml(entries, commit, builtAt));
  console.log(`[floorplans] OK - exported ${entries.length} map(s) to ${rel(outDir)} at ${commit.short}`);
}

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((arg) => arg.startsWith('--')));
const outIndex = rest.indexOf('--out');
const named = rest.filter((arg, i) => !arg.startsWith('--') && rest[i - 1] !== '--out');
const targets = named.length > 0 ? named : mappedPackages();

if (command === 'refresh') {
  refresh(targets);
} else if (command === 'check') {
  reportDrift(refresh(targets), flags.has('--strict'));
} else if (command === 'baseline') {
  writeBaselines(targets);
} else if (command === 'pages') {
  buildPages(resolve(repoRoot, outIndex >= 0 ? rest[outIndex + 1] : join('.pages', 'floorplans')));
} else {
  console.error('usage: node scripts/floorplans.mjs <refresh|check|baseline|pages> [pkg...] [--strict] [--out dir]');
  process.exitCode = 2;
}
