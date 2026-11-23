import { describe, expect, it } from 'vitest';
import {
  BODY_LIMIT,
  buildReleaseBody,
  extractHeader,
  parseChangelogDiff,
} from '../../scripts/release-pr-body.mjs';

const ACTION_BODY = [
  'This PR was opened by the [Changesets release](https://github.com/changesets/action) GitHub action. If you\'re not ready to do a release yet, that\'s fine, whenever you add more changesets to main, this PR will be updated.',
  '',
  '',
  '# Releases',
  '',
  '> The changelog information of each package has been omitted from this message, as the content exceeds the size limit.',
  '',
  '## @kehto/acl@0.20.7',
].join('\n');

function changelogDiff(dir: string, name: string, version: string, entries: string[]): string {
  const added = entries.flatMap((entry) => [`+- ${entry}`, '+', '+  - nested detail that stays out of the summary.', '+']);
  return [
    `diff --git a/${dir}/CHANGELOG.md b/${dir}/CHANGELOG.md`,
    'index c2d8f398..6d0cb5db 100644',
    `--- a/${dir}/CHANGELOG.md`,
    `+++ b/${dir}/CHANGELOG.md`,
    '@@ -1,5 +1,33 @@',
    ` # ${name}`,
    ' ',
    `+## ${version}`,
    '+',
    '+### Minor Changes',
    '+',
    ...added,
    '+- Updated dependencies [d9e4118]',
    '+  - @kehto/acl@0.20.7',
    '+- Updated dependencies [6d21cda]',
    '+',
    ' ## 0.1.0',
    ' ',
    ' - Older entry that must not appear.',
    '',
  ].join('\n');
}

describe('release PR body', () => {
  it('parses each package version and the first sentence of each entry', () => {
    const diff = changelogDiff('packages/acl', '@kehto/acl', '0.20.7', [
      'affae5e: Take the CVM types from core (kehto/web#441). Checked against NAP-CVM PR #31.',
      '5146f60: Move the host line to `@napplet/core` 0.44.0',
    ]);
    expect(parseChangelogDiff(diff)).toEqual([
      {
        name: '@kehto/acl',
        path: 'packages/acl/CHANGELOG.md',
        version: '0.20.7',
        entries: [
          'Take the CVM types from core (kehto/web#441).',
          'Move the host line to `@napplet/core` 0.44.0',
          'Updated dependencies (2 entries)',
        ],
      },
    ]);
  });

  it('keeps the changesets header and lists every entry when under the limit', () => {
    const packages = parseChangelogDiff(changelogDiff('packages/acl', '@kehto/acl', '0.20.7', ['abc1234: Fix one thing.']));
    const body = buildReleaseBody({ header: extractHeader(ACTION_BODY), packages, repo: 'kehto/web', branch: 'changeset-release/main' });

    expect(body.startsWith('This PR was opened by the [Changesets release]')).toBe(true);
    expect(body).not.toContain('has been omitted');
    expect(body).toContain('## @kehto/acl@0.20.7\n\n- Fix one thing.\n- Updated dependencies (2 entries)');
    expect(body).toContain('[Full changelog](https://github.com/kehto/web/blob/changeset-release/main/packages/acl/CHANGELOG.md)');
    expect(body).not.toContain('Older entry');
  });

  it('trims bullets and then caps entries per package when over the limit', () => {
    const long = Array.from({ length: 40 }, (_, index) => `abc1234: Entry ${index} ${'x'.repeat(400)}`);
    const packages = parseChangelogDiff(changelogDiff('packages/runtime', '@kehto/runtime', '0.31.0', long));
    const options = { header: extractHeader(ACTION_BODY), packages, repo: 'kehto/web', branch: 'changeset-release/main' };

    expect(buildReleaseBody(options).length).toBeGreaterThan(5000);

    const trimmed = buildReleaseBody({ ...options, limit: 5000 });
    expect(trimmed.length).toBeLessThanOrEqual(5000);
    expect(trimmed).toMatch(/- Entry 0 x+…/);

    const capped = buildReleaseBody({ ...options, limit: 1500 });
    expect(capped.length).toBeLessThanOrEqual(1500);
    expect(capped).toMatch(/- …and \d+ more/);
    expect(capped).toContain('## @kehto/runtime@0.31.0');
  });

  it('stays under the action limit with many packages', () => {
    const diff = Array.from({ length: 30 }, (_, index) =>
      changelogDiff(`packages/pkg-${index}`, `@kehto/pkg-${index}`, `1.${index}.0`, Array.from({ length: 30 }, (_, entry) => `abc1234: Change ${entry} ${'y'.repeat(300)}.`)),
    ).join('');
    const packages = parseChangelogDiff(diff);
    const body = buildReleaseBody({ header: extractHeader(ACTION_BODY), packages, repo: 'kehto/web', branch: 'changeset-release/main' });

    expect(packages).toHaveLength(30);
    expect(body.length).toBeLessThanOrEqual(BODY_LIMIT);
    for (let index = 0; index < 30; index += 1) expect(body).toContain(`## @kehto/pkg-${index}@1.${index}.0`);
  });

  it('falls back to the action header when the body has none', () => {
    expect(extractHeader('')).toContain('Changesets release');
  });
});
