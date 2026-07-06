import { describe, expect, test } from 'vitest';

import { classifyCiChanges, parseNameStatus } from '../../scripts/classify-ci-changes.mjs';

describe('classifyCiChanges', () => {
  test('marks Version Packages metadata as release-only', () => {
    const rows = parseNameStatus([
      'D\t.changeset/loud-keys-forward.md',
      'M\tdocs/packages/shell.md',
      'M\tpackages/paja/jsr.json',
      'M\tpackages/shell/CHANGELOG.md',
      'M\tpackages/shell/jsr.json',
      'M\tpackages/shell/package.json',
    ].join('\n'));

    const result = classifyCiChanges(rows, {
      prTitle: 'Version Packages',
      headRef: 'changeset-release/main',
    });

    expect(result.releaseOnly).toBe(true);
    expect(result.reason).toBe('Version Packages metadata only');
  });

  test('does not trust release metadata paths outside release intent', () => {
    const rows = parseNameStatus('M\tpackages/shell/package.json');

    const result = classifyCiChanges(rows, {
      prTitle: 'fix shell dependency',
      headRef: 'fix/shell-dependency',
    });

    expect(result.releaseOnly).toBe(false);
    expect(result.reason).toContain('outside a Version Packages context');
  });

  test('does not mark source changes as release-only even on release branches', () => {
    const rows = parseNameStatus([
      'M\tpackages/shell/package.json',
      'M\tpackages/shell/src/napplet-namespace.ts',
    ].join('\n'));

    const result = classifyCiChanges(rows, {
      prTitle: 'Version Packages',
      headRef: 'changeset-release/main',
    });

    expect(result.releaseOnly).toBe(false);
    expect(result.reason).toBe('changed files include non-release metadata');
  });
});
