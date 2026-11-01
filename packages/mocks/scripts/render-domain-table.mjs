#!/usr/bin/env node
/**
 * render-domain-table.mjs — Regenerate the domain table in the package README
 * and docs page from the built registry (`dist/index.js`).
 *
 * Usage: pnpm --filter @kehto/mocks build && node scripts/render-domain-table.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..');
const repoRoot = join(packageRoot, '..', '..');
const START = '<!-- domain-table:start -->';
const END = '<!-- domain-table:end -->';

const { MOCK_NAP_REGISTRY, createMockNapServices } = await import(pathToFileURL(join(packageRoot, 'dist', 'index.js')).href);

/**
 * Build the Markdown table for a registry.
 * @param {ReadonlyArray<{ domain: string, kind: string, spec: { nap: string, status: string, source: string, pr?: number, sha: string }, note?: string }>} registry
 */
export function renderDomainTable(registry) {
  const mocks = createMockNapServices(registry);
  const lines = ['| Domain | NAP | Status | Spec ref | Kind | Routes / note |', '|--------|-----|--------|----------|------|---------------|'];
  for (const entry of registry) {
    const ref = entry.spec.source === 'pr' ? `PR #${entry.spec.pr} @ \`${entry.spec.sha.slice(0, 8)}\`` : `master @ \`${entry.spec.sha.slice(0, 8)}\``;
    const detail = entry.create ? String(mocks.get(entry.domain).mock.routes.length) + ' routes' : (entry.note ?? '');
    lines.push(`| \`${entry.domain}\` | ${entry.spec.nap} | ${entry.spec.status} | ${ref} | ${entry.kind} | ${detail} |`);
  }
  return lines.join('\n');
}

function splice(path, table, check) {
  const text = readFileSync(path, 'utf8');
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start < 0 || end < 0 || end < start) throw new Error(`${path}: missing domain-table markers`);
  const next = `${text.slice(0, start + START.length)}\n${table}\n${text.slice(end)}`;
  if (next === text) return false;
  if (check) throw new Error(`${path}: domain table is out of date; run scripts/render-domain-table.mjs`);
  writeFileSync(path, next);
  return true;
}

const check = process.argv.includes('--check');
const table = renderDomainTable(MOCK_NAP_REGISTRY);
const targets = [join(packageRoot, 'README.md'), join(repoRoot, 'docs', 'packages', 'mocks.md')];
for (const target of targets) {
  const changed = splice(target, table, check);
  console.log(`${changed ? 'updated' : 'unchanged'} ${target}`);
}
