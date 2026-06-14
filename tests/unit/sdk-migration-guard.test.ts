import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sdkTargetDirs = [
  'apps/playground/napplets/bot',
  'apps/playground/napplets/chat',
  'apps/playground/napplets/composer',
  'apps/playground/napplets/config-demo',
  'apps/playground/napplets/feed',
  'apps/playground/napplets/hotkey-chord',
  'apps/playground/napplets/media-controller',
  'apps/playground/napplets/preferences',
  'apps/playground/napplets/profile-viewer',
  'apps/playground/napplets/resource-demo',
  'apps/playground/napplets/theme-switcher',
  'apps/playground/napplets/toaster',
  'tests/fixtures/napplets/nub-identity',
  'tests/fixtures/napplets/nub-ifc',
  'tests/fixtures/napplets/nub-notify',
  'tests/fixtures/napplets/nub-relay',
  'tests/fixtures/napplets/nub-storage',
  'tests/fixtures/napplets/nub-theme',
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
  '@napplet/nub',
  '@napplet/sdk',
  '@napplet/shim',
  '@napplet/vite-plugin',
] as const;

const protocolPackageVersions: Record<(typeof protocolPackageNames)[number], string> = {
  '@napplet/core': '0.5.0',
  '@napplet/nub': '0.5.0',
  '@napplet/sdk': '0.5.0',
  '@napplet/shim': '0.5.0',
  '@napplet/vite-plugin': '0.4.0',
};

const bannedSdkImportPattern = /from\s+['"]@napplet\/sdk['"]/;
const staleNapPackage = ['@napplet', 'nap'].join('/');
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

describe('SDK 0.5 migration guard', () => {
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

  it('keeps all SDK-migrated manifests on the exact 0.5.0 NAP package graph', () => {
    for (const dir of sdkTargetDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.['@napplet/sdk'], `${dir} @napplet/sdk`).toBe('0.5.0');
      expect(pkg.dependencies?.['@napplet/shim'], `${dir} @napplet/shim`).toBe('0.5.0');
      expect(pkg.dependencies?.['@napplet/nub'], `${dir} @napplet/nub`).toBe('0.5.0');
      expect(pkg.dependencies?.[staleNapPackage], `${dir} ${staleNapPackage}`).toBeUndefined();
      expect(pkg.devDependencies?.['@napplet/vite-plugin'], `${dir} @napplet/vite-plugin`).toBe('0.4.0');
    }
  });

  it('keeps all helper-migrated manifests on the exact 0.5.0 NAP helper graph', () => {
    for (const dir of helperTargetDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.['@napplet/shim'], `${dir} @napplet/shim`).toBe('0.5.0');
      expect(pkg.dependencies?.['@napplet/nub'], `${dir} @napplet/nub`).toBe('0.5.0');
      expect(pkg.dependencies?.[staleNapPackage], `${dir} ${staleNapPackage}`).toBeUndefined();
      expect(pkg.devDependencies?.['@napplet/vite-plugin'], `${dir} @napplet/vite-plugin`).toBe('0.4.0');
    }
  });

  it('keeps published kehto packages on @napplet/nub peers and dev deps', () => {
    for (const dir of publicPackageDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        peerDependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      expect(pkg.peerDependencies?.['@napplet/nub'], `${dir} @napplet/nub peer`).toBe('^0.5.0');
      expect(pkg.devDependencies?.['@napplet/nub'], `${dir} @napplet/nub dev`).toBe('^0.5.0');
      expect(pkg.peerDependencies?.[staleNapPackage], `${dir} ${staleNapPackage} peer`).toBeUndefined();
      expect(pkg.devDependencies?.[staleNapPackage], `${dir} ${staleNapPackage} dev`).toBeUndefined();
    }
  });

  it('uses the renamed NAP relay union type at the runtime boundary', () => {
    const file = join(process.cwd(), 'packages/runtime/src/relay-handler.ts');
    const content = readFileSync(file, 'utf8');

    expect(content).toContain("import type { RelayMessage } from '@napplet/nub/relay/types';");
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
