import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

function workflowSource() {
  return readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8');
}

function releaseWorkflowSource() {
  return readFileSync(join(process.cwd(), '.github', 'workflows', 'release.yml'), 'utf8');
}

describe('CI release-only gates', () => {
  test('skips docs generation for generated Version Packages metadata', () => {
    expect(workflowSource()).toMatch(
      /- name: Docs quality gate\n(?:        # .+\n)+        if: \$\{\{ needs\.change_scope\.outputs\.release_only != 'true' \}\}\n        run: pnpm docs:check/,
    );
  });

  test('keeps the JSR metadata sync guard on release-only commits', () => {
    expect(workflowSource()).toMatch(
      /- name: Verify generated JSR metadata is synced\n        if: \$\{\{ needs\.change_scope\.outputs\.release_only == 'true' \}\}\n        run: \|\n          node scripts\/sync-jsr-versions\.mjs\n          git diff --exit-code -- packages/,
    );
  });

  test('pins the OIDC npm CLI to the pnpm 10 compatible release', () => {
    const release = releaseWorkflowSource();
    expect(release).toContain('npm install -g npm@11.17.0');
    expect(release).not.toContain('npm install -g npm@latest');
  });
});
