import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const syntheticReleaseDiff = [
  'D\t.changeset/example.md',
  'M\tpackages/runtime/package.json',
  'M\tpackages/runtime/CHANGELOG.md',
].join('\n');

const syntheticReleaseRepairDiff = [
  'D\t.changeset/example.md',
  'M\tdocs/packages/runtime.md',
  'M\tpackages/runtime/CHANGELOG.md',
].join('\n');

describe('changeset deletion guard', () => {
  it('allows consumed changesets for chore release PR titles', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kehto-changeset-guard-'));
    const diffFile = join(dir, 'diff.txt');
    writeFileSync(diffFile, syntheticReleaseDiff);

    try {
      const output = execFileSync(
        'node',
        ['scripts/check-changeset-deletions.mjs', '--diff-file', diffFile],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            PR_TITLE: 'chore(release): v1.34',
          },
        },
      );

      expect(output).toContain('Allowed consumed changesets');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('allows consumed changesets for explicit release repairs with docs and changelog updates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kehto-changeset-guard-'));
    const diffFile = join(dir, 'diff.txt');
    writeFileSync(diffFile, syntheticReleaseRepairDiff);

    try {
      const output = execFileSync(
        'node',
        ['scripts/check-changeset-deletions.mjs', '--diff-file', diffFile],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            PR_TITLE: 'fix(release): repair unpublished runtime metadata',
          },
        },
      );

      expect(output).toContain('Allowed consumed changesets in release repair PR');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
