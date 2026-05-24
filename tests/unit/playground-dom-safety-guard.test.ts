import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const roots = [
  'apps/playground/src',
  'apps/playground/napplets',
];

const skippedDirs = new Set(['dist', 'node_modules']);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (skippedDirs.has(entry)) return [];
      return listSourceFiles(path);
    }
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('playground DOM safety guard', () => {
  it('keeps playground source free of direct innerHTML assignment sinks', () => {
    const offenders = roots
      .flatMap((root) => listSourceFiles(join(process.cwd(), root)))
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return source
          .split('\n')
          .map((line, index) => ({ line, lineNumber: index + 1 }))
          .filter(({ line }) => /\.\s*innerHTML\s*=/.test(line))
          .map(({ lineNumber }) => `${relative(process.cwd(), file)}:${lineNumber}`);
      });

    expect(offenders).toEqual([]);
  });
});
