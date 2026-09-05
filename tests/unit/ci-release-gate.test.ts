import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

function workflowSource() {
  return readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8');
}

function releaseWorkflowSource() {
  return readFileSync(join(process.cwd(), '.github', 'workflows', 'release.yml'), 'utf8');
}

function versionPackagesWorkflowSource() {
  return readFileSync(join(process.cwd(), '.github', 'workflows', 'publish.yml'), 'utf8');
}

describe('CI release-only gates', () => {
  test('skips docs generation for generated Version Packages metadata', () => {
    expect(workflowSource()).toMatch(
      /- name: Docs quality gate\n(?:        # .+\n)+        if: \$\{\{ needs\.change_scope\.outputs\.release_only != 'true' \}\}\n        run: pnpm docs:check/,
    );
  });

  test('keeps package and docs metadata synchronized on release-only commits', () => {
    expect(workflowSource()).toMatch(
      /- name: Verify generated release metadata is synced\n        if: \$\{\{ needs\.change_scope\.outputs\.release_only == 'true' \}\}\n        run: \|\n          node scripts\/sync-jsr-versions\.mjs\n          git diff --exit-code -- packages docs\/packages/,
    );
  });

  test('pins the OIDC npm CLI to the pnpm 10 compatible release', () => {
    const release = releaseWorkflowSource();
    expect(release).toContain('npm install -g npm@11.17.0');
    expect(release).not.toContain('npm install -g npm@latest');
  });

  test('preserves the main CI actor when routing Version Packages to the sole publisher', () => {
    const versionPackages = versionPackagesWorkflowSource();
    const release = releaseWorkflowSource();
    expect(versionPackages).toContain('name: Version Packages');
    expect(versionPackages).not.toContain('gh workflow run release.yml');
    expect(release).toContain('workflow_run:');
    expect(release).toContain('workflows: [CI]');
    expect(release).toContain("if (context.eventName !== 'workflow_run')");
    expect(release).toContain("pullRequest.title === 'Version Packages'");
    expect(release).toContain("pullRequest.head.ref === 'changeset-release/main'");
    expect(release).toContain("if: ${{ needs.authorize.outputs.should_release == 'true' }}");
    expect(release).toContain('id-token: write');
    expect(release).toContain('ref: ${{ needs.authorize.outputs.release_sha }}');
    expect(release).toContain('git merge-base --is-ancestor "$RELEASE_SHA" origin/main');
  });
});
