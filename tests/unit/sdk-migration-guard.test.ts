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
  'tests/fixtures/napplets/nap-ifc',
  'tests/fixtures/napplets/nap-notify',
  'tests/fixtures/napplets/nap-relay',
  'tests/fixtures/napplets/nap-storage',
  'tests/fixtures/napplets/nap-theme',
] as const;

const helperTargetDirs = [
  ...sdkTargetDirs,
] as const;

const publicPackageDirs = [
  'packages/acl',
  'packages/runtime',
  'packages/services',
  'packages/shell',
] as const;

const protocolPackageNames = [
  '@napplet/core',
  '@napplet/nap',
  '@napplet/sdk',
  '@napplet/shim',
  '@napplet/vite-plugin',
] as const;

const protocolPackageVersions: Record<(typeof protocolPackageNames)[number], string> = {
  '@napplet/core': '0.12.0',
  '@napplet/nap': '0.12.0',
  '@napplet/sdk': '0.12.0',
  '@napplet/shim': '0.13.0',
  '@napplet/vite-plugin': '0.8.1',
};

const bannedSdkImportPattern = /from\s+['"]@napplet\/sdk['"]/;
const staleNapPackage = ['@napplet', 'nub'].join('/');
const oldIfcNamespace = ['i', 'p', 'c'].join('');
const namespaceImportPattern = new RegExp(
  String.raw`import\s+\{[^}]*\b(${oldIfcNamespace}|storage|relay|identity|keys|config|notify)\b[^}]*\}\s+from\s+['"]@napplet/sdk['"]`,
  's',
);
const activeTerminologyRoots = [
  'RUNTIME-SPEC.md',
  'apps',
  'packages',
  'tests',
] as const;
const activeTerminologyFilePattern = /\.(?:[cm]?[jt]sx?|json|md|html|css)$/;

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

function activeTerminologyFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const stat = statSync(root);
  if (!stat.isDirectory()) return activeTerminologyFilePattern.test(root) ? [root] : [];

  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    if (entry === 'dist' || entry === 'node_modules') continue;
    files.push(...activeTerminologyFiles(join(root, entry)));
  }
  return files;
}

describe('SDK 0.12 migration guard', () => {
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

  it('keeps all SDK-migrated manifests on the exact 0.12 NAP package graph', () => {
    for (const dir of sdkTargetDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.['@napplet/sdk'], `${dir} @napplet/sdk`).toBe('0.12.0');
      expect(pkg.dependencies?.['@napplet/shim'], `${dir} @napplet/shim`).toBe('0.13.0');
      expect(pkg.dependencies?.['@napplet/nap'], `${dir} @napplet/nap`).toBe('0.12.0');
      expect(pkg.dependencies?.[staleNapPackage], `${dir} ${staleNapPackage}`).toBeUndefined();
      expect(pkg.devDependencies?.['@napplet/vite-plugin'], `${dir} @napplet/vite-plugin`).toBe('0.8.1');
    }
  });

  it('keeps all helper-migrated manifests on the exact 0.12 NAP helper graph', () => {
    for (const dir of helperTargetDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.['@napplet/shim'], `${dir} @napplet/shim`).toBe('0.13.0');
      expect(pkg.dependencies?.['@napplet/nap'], `${dir} @napplet/nap`).toBe('0.12.0');
      expect(pkg.dependencies?.[staleNapPackage], `${dir} ${staleNapPackage}`).toBeUndefined();
      expect(pkg.devDependencies?.['@napplet/vite-plugin'], `${dir} @napplet/vite-plugin`).toBe('0.8.1');
    }
  });

  it('admits the @napplet 0.12–0.13 line on published kehto packages (kehto/web#48)', () => {
    // Peers are widened to admit @napplet 0.13 (caret on 0.x pins the minor, so
    // `^0.12.0` excluded 0.13 and broke consumers on the current @napplet line).
    // `>=0.12.0 <0.14.0` keeps 0.12 backward-compatible while admitting 0.13.
    // Dev deps track the current 0.13 line so kehto's own CI validates against it.
    const PEER_RANGE = '>=0.12.0 <0.14.0';
    const DEV_RANGE = '^0.13.0';
    for (const dir of publicPackageDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        peerDependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      expect(pkg.peerDependencies?.['@napplet/nap'], `${dir} @napplet/nap peer`).toBe(PEER_RANGE);
      expect(pkg.devDependencies?.['@napplet/nap'], `${dir} @napplet/nap dev`).toBe(DEV_RANGE);
      expect(pkg.peerDependencies?.[staleNapPackage], `${dir} ${staleNapPackage} peer`).toBeUndefined();
      expect(pkg.devDependencies?.[staleNapPackage], `${dir} ${staleNapPackage} dev`).toBeUndefined();
    }
  });

  it('uses the renamed NAP relay union type at the runtime boundary', () => {
    const file = join(process.cwd(), 'packages/runtime/src/relay-handler.ts');
    const content = readFileSync(file, 'utf8');

    expect(content).toContain("import type { RelayMessage } from '@napplet/nap/relay/types';");
    expect(content).not.toContain('RelayNapMessage');
    expect(content).not.toContain('RelayNubMessage');
  });

  it('rejects old napplet helper package resolutions from the active lockfile graph', () => {
    const lockfile = readFileSync(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8');

    expect(lockfile).not.toMatch(/@napplet\/(?:core|shim|vite-plugin)@0\.2\.1/);
    expect(lockfile).not.toMatch(/@napplet\/nub-(?:identity|ifc|keys|media|notify|relay|storage|theme)@0\.2\.1/);
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

  it('keeps active project terminology on IFC vocabulary', () => {
    const violations: string[] = [];
    const disallowedTerm = oldIfcNamespace.toLowerCase();
    const disallowedTermPattern = new RegExp(String.raw`\b${disallowedTerm}\b`);

    for (const root of activeTerminologyRoots) {
      for (const file of activeTerminologyFiles(join(process.cwd(), root))) {
        const content = readFileSync(file, 'utf8').toLowerCase();
        if (disallowedTermPattern.test(content)) {
          violations.push(relative(process.cwd(), file));
        }
      }
    }

    expect(violations).toEqual([]);
  });

});
