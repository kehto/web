import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

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

  test('uses the custom credential for both git pushes and version PR API calls', () => {
    const workflow = versionPackagesWorkflowSource();
    expect(workflow).toContain('token: ${{ secrets.CHANGESETS_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}');
    expect(workflow).toContain('github-token: ${{ secrets.CHANGESETS_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}');
    expect(workflow).not.toContain('GITHUB_TOKEN: ${{ secrets.CHANGESETS_GITHUB_TOKEN');
  });

  test('warns about missing PR workflow approval only when changesets are pending', async () => {
    const script = versionPackagesWorkflowSource()
      .split('      - name: Explain version PR workflow approval requirements')[1]
      .split('          script: |\n')[1]
      .split('\n      #')[0]
      .replace(/^            /gm, '');
    const execute = new (Object.getPrototypeOf(async function () {}).constructor)(
      'require', 'process', 'core', script,
    );
    for (const [files, token, warningCount] of [
      [['README.md', 'config.json'], '', 0],
      [['README.md', 'fix.md'], '', 1],
      [['fix.md'], 'dedicated-token', 0],
    ] as const) {
      const warnings: string[] = [];
      let summaryWritten = false;
      const summary = {
        addHeading: () => summary,
        addRaw: () => summary,
        write: async () => { summaryWritten = true; },
      };
      await execute(
        () => ({ readdirSync: () => files }),
        { env: { CHANGESETS_TOKEN: token } },
        { warning: (message: string) => warnings.push(message), summary },
      );
      expect(warnings).toHaveLength(warningCount);
      expect(summaryWritten).toBe(warningCount === 1);
      if (warningCount) expect(warnings[0]).toContain('approve the Version Packages PR workflows');
    }
  });

  test('requires built artifacts and synced metadata before attempting JSR', () => {
    const release = releaseWorkflowSource();
    expect(release).toContain('name: Build all packages\n        id: build');
    expect(release).toContain("id: jsr_metadata\n        if: ${{ !cancelled() && steps.build.outcome == 'success' }}");
    expect(release).toContain("name: Publish to JSR (topologically ordered)\n        if: ${{ !cancelled() && steps.jsr_metadata.outcome == 'success' }}");
  });

  test('attempts independent JSR packages after a rejection and keeps partial releases red', () => {
    const directory = mkdtempSync(join(tmpdir(), 'kehto-release-jsr-'));
    try {
      writeFileSync(join(directory, 'package.json'), '{"private":true,"packageManager":"pnpm@10.8.0"}');
      writeFileSync(join(directory, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
      for (const slug of ['broken', 'independent']) {
        const packageDirectory = join(directory, 'packages', slug);
        mkdirSync(packageDirectory, { recursive: true });
        writeFileSync(join(packageDirectory, 'package.json'), JSON.stringify({ name: `@test/${slug}`, version: '1.0.0' }));
      }
      const bin = join(directory, 'bin');
      const log = join(directory, 'attempts');
      mkdirSync(bin);
      // Exercise the workflow's real pnpm command, replacing only the registry CLI.
      writeFileSync(join(bin, 'npx'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const slug = path.basename(process.cwd());
fs.appendFileSync(process.env.ATTEMPTS, slug + '\\n');
if (slug === 'broken' && process.env.REJECT_PUBLISH === 'true') process.exit(1);
`, { mode: 0o755 });
      const command = releaseWorkflowSource().split('\n').find((line) => line.includes('pnpm -r --no-bail'))?.trim();
      expect(command).toBeTruthy();
      for (const rejected of [true, false]) {
        writeFileSync(log, '');
        const result = spawnSync('bash', ['-c', `filter_args=(--filter='./packages/*')\n${command}`], {
          cwd: directory,
          encoding: 'utf8',
          env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, ATTEMPTS: log, REJECT_PUBLISH: String(rejected) },
          timeout: 20_000,
        });
        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(rejected ? 1 : 0);
        expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual(['broken', 'independent']);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
