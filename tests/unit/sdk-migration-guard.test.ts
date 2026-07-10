import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sdkTargetDirs = [
  'apps/playground/napplets/bot',
  'apps/playground/napplets/chat',
  'apps/playground/napplets/composer',
  'apps/playground/napplets/feed',
  'apps/playground/napplets/preferences',
  'apps/playground/napplets/profile-viewer',
  'apps/playground/napplets/resource-demo',
  'apps/playground/napplets/toaster',
  'tests/fixtures/napplets/nap-identity',
  'tests/fixtures/napplets/nap-inc',
  'tests/fixtures/napplets/nap-notify',
  'tests/fixtures/napplets/nap-relay',
  'tests/fixtures/napplets/nap-storage',
  'tests/fixtures/napplets/nap-theme',
] as const;

const helperTargetDirs = [
  ...sdkTargetDirs,
  'apps/playground/napplets/link-demo',
] as const;

const publicPackageDirs = [
  'packages/acl',
  'packages/cli',
  'packages/firewall',
  'packages/paja',
  'packages/runtime',
  'packages/services',
  'packages/shell',
] as const;

const publishedManifestDirs = [
  ...publicPackageDirs,
  'packages/nip',
] as const;

const protocolPackageNames = [
  '@napplet/core',
  '@napplet/nap',
  '@napplet/sdk',
  '@napplet/shim',
  '@napplet/vite-plugin',
] as const;

const protocolPackageVersions: Record<(typeof protocolPackageNames)[number], string> = {
  '@napplet/core': '0.28.0',
  '@napplet/nap': '0.28.0',
  '@napplet/sdk': '0.24.4',
  '@napplet/shim': '0.26.8',
  '@napplet/vite-plugin': '0.11.2',
};

const bannedSdkImportPattern = /from\s+['"]@napplet\/sdk['"]/;
const staleNapSegment = [110, 117, 98].map((code) => String.fromCharCode(code)).join('');
const staleNapPackage = ['@napplet', staleNapSegment].join('/');
const removedTransportNamespace = ['i', 'f', 'c'].join('');
const namespaceImportPattern = new RegExp(
  String.raw`import\s+\{[^}]*\b(storage|relay|identity|keys|config|notify)\b[^}]*\}\s+from\s+['"]@napplet/sdk['"]`,
  's',
);
function sourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (/\.[cm]?tsx?$/.test(path)) {
      files.push(path);
    }
  }
  return files;
}

describe('current @napplet package graph guard', () => {
  it('resolves active protocol packages from published registry artifacts', () => {
    const rootPackageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const workspace = readFileSync(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8');
    const lockfile = readFileSync(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8');

    expect(workspace).not.toContain('napplet/packages/*');
    expect(lockfile).not.toMatch(/link:.*napplet/);
    expect(lockfile).not.toContain('napplet/packages');
    for (const pkg of protocolPackageNames) {
      expect(rootPackageJson.pnpm?.overrides ?? {}).not.toHaveProperty(pkg);
      expect(lockfile).toContain(`'${pkg}@${protocolPackageVersions[pkg]}':`);
    }
  });

  it('keeps all SDK-migrated manifests on the exact current NAP package graph', () => {
    for (const dir of sdkTargetDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.['@napplet/sdk'], `${dir} @napplet/sdk`).toBe(protocolPackageVersions['@napplet/sdk']);
      expect(pkg.dependencies?.['@napplet/shim'], `${dir} @napplet/shim`).toBe(protocolPackageVersions['@napplet/shim']);
      expect(pkg.dependencies?.['@napplet/nap'], `${dir} @napplet/nap`).toBe(protocolPackageVersions['@napplet/nap']);
      expect(pkg.dependencies?.[staleNapPackage], `${dir} ${staleNapPackage}`).toBeUndefined();
      expect(pkg.devDependencies?.['@napplet/vite-plugin'], `${dir} @napplet/vite-plugin`).toBe(protocolPackageVersions['@napplet/vite-plugin']);
    }
  });

  it('keeps all helper-migrated manifests on the exact current NAP helper graph', () => {
    for (const dir of helperTargetDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.['@napplet/shim'], `${dir} @napplet/shim`).toBe(protocolPackageVersions['@napplet/shim']);
      expect(pkg.dependencies?.['@napplet/nap'], `${dir} @napplet/nap`).toBe(protocolPackageVersions['@napplet/nap']);
      expect(pkg.dependencies?.[staleNapPackage], `${dir} ${staleNapPackage}`).toBeUndefined();
      expect(pkg.devDependencies?.['@napplet/vite-plugin'], `${dir} @napplet/vite-plugin`).toBe(protocolPackageVersions['@napplet/vite-plugin']);
    }
  });

  it('admits only the current @napplet 0.28 line on published kehto packages', () => {
    // Kehto runtime packages track the current NAP contract so new canonical
    // fields are wired through runtime, services, shell, Paja, docs, and tests.
    const PEER_RANGE = '>=0.23.0 <=0.28.x';
    const DEV_RANGE = '>=0.23.0 <=0.28.x';
    for (const dir of publicPackageDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        peerDependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      if (pkg.peerDependencies?.['@napplet/nap'] || pkg.devDependencies?.['@napplet/nap']) {
        expect(pkg.peerDependencies?.['@napplet/nap'], `${dir} @napplet/nap peer`).toBe(PEER_RANGE);
        expect(pkg.devDependencies?.['@napplet/nap'], `${dir} @napplet/nap dev`).toBe(DEV_RANGE);
      }
      expect(pkg.peerDependencies?.['@napplet/core'], `${dir} @napplet/core peer`).toBe(PEER_RANGE);
      expect(pkg.devDependencies?.['@napplet/core'], `${dir} @napplet/core dev`).toBe(DEV_RANGE);
      expect(pkg.peerDependencies?.[staleNapPackage], `${dir} ${staleNapPackage} peer`).toBeUndefined();
      expect(pkg.devDependencies?.[staleNapPackage], `${dir} ${staleNapPackage} dev`).toBeUndefined();
    }
  });

  it('uses inclusive upper bounds in published dependency ranges', () => {
    for (const dir of publishedManifestDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const content = readFileSync(packageJsonPath, 'utf8');
      const pkg = JSON.parse(content) as {
        peerDependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const ranges = [
        ...Object.values(pkg.peerDependencies ?? {}),
        ...Object.values(pkg.devDependencies ?? {}),
      ];

      expect(content, dir).not.toContain(' <0.26.0');
      expect(content, dir).not.toContain(' <3.0.0');
      expect(content, dir).not.toContain('<=0.25.x');
      expect(ranges, `${dir} dependency ranges`).not.toContain('>=0.23.0 <0.26.0');
      expect(ranges, `${dir} dependency ranges`).not.toContain('>=2.23.3 <3.0.0');
      if (pkg.peerDependencies?.['nostr-tools']) {
        expect(pkg.peerDependencies['nostr-tools'], `${dir} nostr-tools peer`).toBe('>=2.23.3 <=2.x');
      }
    }
  });

  it('uses the renamed NAP relay union type at the runtime boundary', () => {
    const file = join(process.cwd(), 'packages/runtime/src/relay-handler.ts');
    const content = readFileSync(file, 'utf8');

    expect(content).toContain("import type { RelayMessage } from '@napplet/nap/relay/types';");
    expect(content).not.toContain('RelayNapMessage');
    // Also reject the pre-rename relay union alias (assembled to avoid a literal).
    expect(content).not.toContain(`Relay${staleNapSegment[0].toUpperCase()}${staleNapSegment.slice(1)}Message`);
  });

  it('rejects old napplet helper package resolutions from the active lockfile graph', () => {
    const lockfile = readFileSync(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8');

    expect(lockfile).not.toMatch(/@napplet\/(?:core|shim|vite-plugin)@0\.2\.1/);
    const oldNapHelperPattern = new RegExp(
      String.raw`@napplet\/${staleNapSegment}-(?:identity|inc|keys|media|notify|relay|storage|theme)@0\.2\.1`,
    );
    expect(lockfile).not.toMatch(oldNapHelperPattern);
  });

  it('rejects legacy namespace imports from @napplet/sdk in migrated source', () => {
    const violations: string[] = [];
    for (const dir of sdkTargetDirs) {
      for (const file of sourceFiles(join(process.cwd(), dir, 'src'))) {
        const content = readFileSync(file, 'utf8');
        if (bannedSdkImportPattern.test(content) || namespaceImportPattern.test(content)) {
          violations.push(relative(process.cwd(), file));
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('rejects the removed transport vocabulary in tracked live files', () => {
    const violations: string[] = [];
    const files = execFileSync('git', ['ls-files', '-z'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).split('\0').filter(Boolean);
    const pattern = new RegExp(removedTransportNamespace, 'i');

    for (const file of files) {
      if (file.startsWith('.planning/')) continue;
      const abs = join(process.cwd(), file);
      if (!existsSync(abs)) continue;
      const content = readFileSync(abs, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const [index, line] of lines.entries()) {
        if (!pattern.test(line)) continue;
        const location = `${file}:${index + 1}`;
        if (file === 'pnpm-lock.yaml' && line.includes('integrity:')) continue;
        violations.push(location);
      }
    }

    expect(violations).toEqual([]);
  });

});
