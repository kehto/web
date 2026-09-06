import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts', 'check-napplet-dependency-direction.mjs');

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  pnpm?: { overrides?: Record<string, string> };
};

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function createHistory(baseManifest: Manifest, headManifest: Manifest): { root: string; base: string; head: string } {
  const root = mkdtempSync(join(tmpdir(), 'kehto-napplet-direction-'));
  mkdirSync(join(root, 'packages', 'demo'), { recursive: true });
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Dependency Direction Test']);

  writeFileSync(join(root, 'packages', 'demo', 'package.json'), `${JSON.stringify(baseManifest, null, 2)}\n`);
  git(root, ['add', 'packages/demo/package.json']);
  git(root, ['commit', '--quiet', '-m', 'base']);
  const base = git(root, ['rev-parse', 'HEAD']).trim();

  writeFileSync(join(root, 'packages', 'demo', 'package.json'), `${JSON.stringify(headManifest, null, 2)}\n`);
  git(root, ['add', 'packages/demo/package.json']);
  git(root, ['commit', '--quiet', '-m', 'head']);
  return { root, base, head: git(root, ['rev-parse', 'HEAD']).trim() };
}

function createNewPackageHistory(headManifest: Manifest | string): { root: string; base: string; head: string } {
  const root = mkdtempSync(join(tmpdir(), 'kehto-napplet-direction-'));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Dependency Direction Test']);
  git(root, ['commit', '--allow-empty', '--quiet', '-m', 'base']);
  const base = git(root, ['rev-parse', 'HEAD']).trim();

  mkdirSync(join(root, 'packages', 'new-package'), { recursive: true });
  const content = typeof headManifest === 'string' ? headManifest : `${JSON.stringify(headManifest, null, 2)}\n`;
  writeFileSync(join(root, 'packages', 'new-package', 'package.json'), content);
  git(root, ['add', 'packages/new-package/package.json']);
  git(root, ['commit', '--quiet', '-m', 'add package']);
  return { root, base, head: git(root, ['rev-parse', 'HEAD']).trim() };
}

function createMalformedBaseHistory(): { root: string; base: string; head: string } {
  const root = mkdtempSync(join(tmpdir(), 'kehto-napplet-direction-'));
  mkdirSync(join(root, 'packages', 'demo'), { recursive: true });
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Dependency Direction Test']);

  writeFileSync(join(root, 'packages', 'demo', 'package.json'), '{invalid json\n');
  git(root, ['add', 'packages/demo/package.json']);
  git(root, ['commit', '--quiet', '-m', 'base']);
  const base = git(root, ['rev-parse', 'HEAD']).trim();

  writeFileSync(join(root, 'packages', 'demo', 'package.json'), '{"dependencies":{"@napplet/core":"0.31.0"}}\n');
  git(root, ['add', 'packages/demo/package.json']);
  git(root, ['commit', '--quiet', '-m', 'head']);
  return { root, base, head: git(root, ['rev-parse', 'HEAD']).trim() };
}

function runGuard(root: string, base: string, head: string) {
  return spawnSync(process.execPath, [SCRIPT, '--base', base, '--head', head], {
    cwd: root,
    encoding: 'utf8',
  });
}

describe('Napplet dependency direction guard', () => {
  it('accepts unchanged and newer @napplet dependency declarations', () => {
    const history = createHistory(
      {
        dependencies: { '@napplet/core': '0.31.0' },
        devDependencies: { '@napplet/shim': '0.29.0' },
        peerDependencies: { '@napplet/nap': '>=0.31.0 <0.32.0' },
        pnpm: { overrides: { '@napplet/sdk': '0.27.0' } },
      },
      {
        dependencies: { '@napplet/core': '0.31.0' },
        devDependencies: { '@napplet/shim': '0.30.0' },
        peerDependencies: { '@napplet/nap': '>=0.32.0 <0.33.0' },
        pnpm: { overrides: { '@napplet/sdk': '0.28.0' } },
      },
    );
    try {
      const result = runGuard(history.root, history.base, history.head);
      expect(result.status, result.stderr).toBe(0);
    } finally {
      rmSync(history.root, { recursive: true, force: true });
    }
  });

  it('rejects a lower declared @napplet dependency version', () => {
    const history = createHistory(
      { dependencies: { '@napplet/core': '0.31.0' } },
      { dependencies: { '@napplet/core': '0.29.0' } },
    );
    try {
      const result = runGuard(history.root, history.base, history.head);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('packages/demo/package.json dependencies.@napplet/core decreased from 0.31.0 to 0.29.0');
    } finally {
      rmSync(history.root, { recursive: true, force: true });
    }
  });

  it('rejects a lower @napplet pnpm override and a removed dependency declaration', () => {
    const history = createHistory(
      {
        dependencies: { '@napplet/nap': '0.31.0' },
        pnpm: { overrides: { '@napplet/vite-plugin': '0.14.0' } },
      },
      { pnpm: { overrides: { '@napplet/vite-plugin': '0.12.0' } } },
    );
    try {
      const result = runGuard(history.root, history.base, history.head);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('packages/demo/package.json dependencies.@napplet/nap was removed');
      expect(result.stderr).toContain('packages/demo/package.json pnpm.overrides.@napplet/vite-plugin decreased from 0.14.0 to 0.12.0');
    } finally {
      rmSync(history.root, { recursive: true, force: true });
    }
  });

  it('ignores unrelated manifest changes', () => {
    const history = createHistory(
      { dependencies: { react: '18.3.0' } },
      { dependencies: { react: '19.0.0' } },
    );
    try {
      const result = runGuard(history.root, history.base, history.head);
      expect(result.status, result.stderr).toBe(0);
    } finally {
      rmSync(history.root, { recursive: true, force: true });
    }
  });

  it('accepts a @napplet dependency declaration in a package added after base', () => {
    const history = createNewPackageHistory({
      dependencies: { '@napplet/core': '0.31.0' },
    });
    try {
      const result = runGuard(history.root, history.base, history.head);
      expect(result.status, result.stderr).toBe(0);
    } finally {
      rmSync(history.root, { recursive: true, force: true });
    }
  });

  it('fails closed when an existing base manifest is malformed', () => {
    const history = createMalformedBaseHistory();
    try {
      const result = runGuard(history.root, history.base, history.head);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`could not parse ${history.base}:packages/demo/package.json`);
    } finally {
      rmSync(history.root, { recursive: true, force: true });
    }
  });

  it('fails closed when a head-only package manifest is malformed', () => {
    const history = createNewPackageHistory('{invalid json\n');
    try {
      const result = runGuard(history.root, history.base, history.head);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`could not parse ${history.head}:packages/new-package/package.json`);
    } finally {
      rmSync(history.root, { recursive: true, force: true });
    }
  });
});
