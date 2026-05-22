import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const targetDirs = [
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

const bannedSdkImportPattern = /from\s+['"]@napplet\/sdk['"]/;
const namespaceImportPattern =
  /import\s+\{[^}]*\b(ipc|storage|relay|identity|keys|config|notify)\b[^}]*\}\s+from\s+['"]@napplet\/sdk['"]/s;

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

describe('SDK 0.3 migration guard', () => {
  it('keeps all migrated manifests on the exact 0.3 package graph', () => {
    for (const dir of targetDirs) {
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

  it('rejects legacy namespace imports from @napplet/sdk in migrated source', () => {
    const violations: string[] = [];
    for (const dir of targetDirs) {
      for (const file of sourceFiles(join(process.cwd(), dir, 'src'))) {
        const content = readFileSync(file, 'utf8');
        if (bannedSdkImportPattern.test(content) || namespaceImportPattern.test(content)) {
          violations.push(relative(process.cwd(), file));
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
