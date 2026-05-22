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
  'apps/playground/napplets/decrypt-demo',
] as const;
const localProtocolPackageOverrides = {
  '@napplet/core': 'link:napplet/packages/core',
  '@napplet/nub': 'link:napplet/packages/nub',
  '@napplet/sdk': 'link:napplet/packages/sdk',
  '@napplet/shim': 'link:napplet/packages/shim',
  '@napplet/vite-plugin': 'link:napplet/packages/vite-plugin',
} as const;

const bannedSdkImportPattern = /from\s+['"]@napplet\/sdk['"]/;
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
const bannedDecryptPlumbingPatterns = [
  /\brequestCounter\b/,
  /new\s+Map\s*<\s*string\s*,\s*\([^)]*\)\s*=>\s*void\s*>\s*\(/,
  /window\.parent\.postMessage\s*\(\s*\{\s*type:\s*['"]identity\.decrypt['"]/s,
] as const;

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

describe('SDK 0.3 migration guard', () => {
  it('resolves active protocol packages from repo-local sources', () => {
    const rootPackageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const workspace = readFileSync(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8');
    const lockfile = readFileSync(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8');

    expect(workspace).toContain('napplet/packages/*');
    expect(rootPackageJson.pnpm?.overrides).toMatchObject(localProtocolPackageOverrides);
    for (const [pkg, linkTarget] of Object.entries(localProtocolPackageOverrides)) {
      expect(lockfile).toContain(`'${pkg}': ${linkTarget}`);
    }
    expect(lockfile).not.toMatch(/^  '@napplet\/(?:core|nub|sdk|shim)@\d/m);
  });

  it('keeps all SDK-migrated manifests on the exact 0.3 package graph', () => {
    for (const dir of sdkTargetDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.['@napplet/sdk'], `${dir} @napplet/sdk`).toBe('0.3.0');
      expect(pkg.dependencies?.['@napplet/shim'], `${dir} @napplet/shim`).toBe('0.3.0');
      expect(pkg.dependencies?.['@napplet/nub'], `${dir} @napplet/nub`).toBe('0.3.0');
      expect(pkg.devDependencies?.['@napplet/vite-plugin'], `${dir} @napplet/vite-plugin`).toBe('0.3.0');
    }
  });

  it('keeps all helper-migrated manifests on the exact 0.3 helper graph', () => {
    for (const dir of helperTargetDirs) {
      const packageJsonPath = join(process.cwd(), dir, 'package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.['@napplet/shim'], `${dir} @napplet/shim`).toBe('0.3.0');
      expect(pkg.dependencies?.['@napplet/nub'], `${dir} @napplet/nub`).toBe('0.3.0');
      expect(pkg.devDependencies?.['@napplet/vite-plugin'], `${dir} @napplet/vite-plugin`).toBe('0.3.0');
    }
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

    for (const root of activeTerminologyRoots) {
      for (const file of activeTerminologyFiles(join(process.cwd(), root))) {
        const content = readFileSync(file, 'utf8').toLowerCase();
        if (content.includes(disallowedTerm)) {
          violations.push(relative(process.cwd(), file));
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps decrypt-demo on identityDecrypt instead of manual identity.decrypt plumbing', () => {
    const file = join(process.cwd(), 'apps/playground/napplets/decrypt-demo/src/main.ts');
    const content = readFileSync(file, 'utf8');

    expect(content).toContain("import { identityDecrypt } from '@napplet/nub/identity/sdk';");
    for (const pattern of bannedDecryptPlumbingPatterns) {
      expect(content).not.toMatch(pattern);
    }
  });
});
