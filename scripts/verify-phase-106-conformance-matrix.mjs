#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const matrixPath = resolve(repoRoot, '.planning/phases/106-active-surface-conformance-and-release/106-CONFORMANCE-MATRIX.md');
const requirementsPath = resolve(repoRoot, '.planning/REQUIREMENTS.md');
const CANONICAL_COMMAND = 'node scripts/verify-phase-106-conformance-matrix.mjs --check';
const FOCUSED_TEST_FILES = [
  'tests/unit/nip5d-conformance-guard.test.ts',
  'tests/unit/sdk-migration-guard.test.ts',
  'tests/unit/napplet-package-alignment.test.ts',
  'tests/unit/published-napplet-contract.test.ts',
  'packages/shell/src/napplet-namespace.test.ts',
  'packages/shell/src/shell-supports-conformance.test.ts',
  'tests/unit/identity-theme-conformance-guard.test.ts',
  'tests/unit/nap-inc-conformance.test.ts',
];

function parseCompletedRequirements() {
  const text = readFileSync(requirementsPath, 'utf8');
  const traceability = text.slice(text.indexOf('## Traceability'));
  return [...traceability.matchAll(/^\| ([A-Z]+-\d+) \| Phase (10[1-5]) \| Complete \|$/gm)].map((match) => match[1]);
}

function parseMatrixRows() {
  const text = readFileSync(matrixPath, 'utf8');
  const header = '| Requirement | Test file | Exact test title | Positive evidence | Negative / trust-boundary evidence | Focused command | Result |';
  const start = text.indexOf(header);
  if (start < 0) throw new Error('matrix has no exact required header');
  return text.slice(start + header.length).split('\n').slice(2)
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function validateMatrixRows(required, rows) {
  const failures = [];
  if (required.length === 0) failures.push('no completed Phase 101-105 requirements parsed');
  if (rows.length !== required.length) failures.push(`matrix has ${rows.length} rows for ${required.length} completed requirements`);
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    if (row.length !== 7) { failures.push(`row ${index + 1} has ${row.length} columns`); continue; }
    const [requirement, testFile, title, positive, negative, command, result] = row;
    if (requirement !== required[index]) failures.push(`row ${index + 1} requirement ${requirement} is missing, duplicate, or out of traceability order`);
    if (seen.has(requirement)) failures.push(`duplicate requirement ${requirement}`);
    seen.add(requirement);
    if (!FOCUSED_TEST_FILES.includes(testFile)) failures.push(`${requirement} uses unallowlisted test file ${testFile}`);
    const absolute = resolve(repoRoot, testFile);
    if (!testFile || !absolute.startsWith(`${repoRoot}/`) || !existsSync(absolute) || !statSync(absolute).isFile()) failures.push(`${requirement} test file is absent or outside the repository`);
    else if (!title || !readFileSync(absolute, 'utf8').includes(title)) failures.push(`${requirement} exact test title is absent from ${testFile}`);
    if (!positive || !negative) failures.push(`${requirement} has blank positive or negative/trust evidence`);
    if (command !== CANONICAL_COMMAND) failures.push(`${requirement} command is not canonical`);
    if (!result || !/^PASS\b/.test(result)) failures.push(`${requirement} result is missing, pending, or non-pass`);
  }
  for (const requirement of required) if (!seen.has(requirement)) failures.push(`missing requirement ${requirement}`);
  return failures;
}

function runFocusedTests() {
  return spawnSync('pnpm', ['exec', 'vitest', 'run', ...FOCUSED_TEST_FILES], { cwd: repoRoot, stdio: 'inherit' }).status ?? 1;
}

function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--check') {
    console.error('Usage: node scripts/verify-phase-106-conformance-matrix.mjs --check');
    process.exit(2);
  }
  let rows = [];
  const failures = [];
  try { rows = parseMatrixRows(); } catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
  const required = parseCompletedRequirements();
  failures.push(...validateMatrixRows(required, rows));
  if (failures.length > 0) {
    for (const failure of failures) console.error(`verify:phase-106-matrix FAILED — ${failure}`);
    process.exit(1);
  }
  const status = runFocusedTests();
  if (status !== 0) process.exit(status);
  console.log(`[verify:phase-106-matrix] OK — ${required.length} requirements, ${FOCUSED_TEST_FILES.length} focused files`);
}

main();
