import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
}

const dependencySections = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

const ignoredDirectories = new Set([
  '.git',
  '.claude',
  '.turbo',
  '.vite',
  'coverage',
  'dist',
  'node_modules',
]);

function findPackageJsonFiles(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        findPackageJsonFiles(join(directory, entry.name), files);
      }
      continue;
    }

    if (entry.name === 'package.json') files.push(join(directory, entry.name));
  }

  return files;
}

describe('internal workspace dependency ranges', () => {
  it('keeps @kehto package edges managed by pnpm workspace caret ranges', () => {
    const hardcodedRanges: string[] = [];

    for (const packageJsonPath of findPackageJsonFiles(process.cwd())) {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;

      for (const section of dependencySections) {
        for (const [name, range] of Object.entries(pkg[section] ?? {})) {
          if (!name.startsWith('@kehto/')) continue;
          if (range === 'workspace:^') continue;

          hardcodedRanges.push(`${relative(process.cwd(), packageJsonPath)} ${section}.${name}=${range}`);
        }
      }
    }

    expect(hardcodedRanges).toEqual([]);
  });
});
