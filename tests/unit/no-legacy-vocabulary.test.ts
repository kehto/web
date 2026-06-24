import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { describe, expect, it } from 'vitest';

const terms = [
  [110, 117, 98],
  [78, 117, 98],
  [78, 85, 66],
].map((chars) => chars.map((char) => String.fromCharCode(char)).join(''));

const scannedPrefixes = [
  '.changeset/',
  'apps/',
  'docs/',
  'packages/',
  'scripts/',
  'specs/',
  'tests/',
];

const scannedRootFiles = new Set([
  'README.md',
  'RUNTIME-SPEC.md',
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.json',
  'vitest.config.ts',
]);

const skippedPrefixes = [
  'docs/api/',
];

const skippedFiles = new Set([
  'pnpm-lock.yaml',
]);

const textExtensions = new Set([
  '.css',
  '.cjs',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.toml',
  '.yaml',
  '.yml',
]);

function shouldScan(file: string): boolean {
  if (skippedFiles.has(file)) return false;
  if (skippedPrefixes.some((prefix) => file.startsWith(prefix))) return false;
  if (!scannedRootFiles.has(file) && !scannedPrefixes.some((prefix) => file.startsWith(prefix))) return false;
  return textExtensions.has(extname(file));
}

describe('legacy vocabulary guard', () => {
  it('keeps tracked source and docs clear of retired protocol spelling', () => {
    const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).split('\0').filter(Boolean);

    const violations: string[] = [];

    for (const file of trackedFiles) {
      if (!shouldScan(file)) continue;
      if (!existsSync(file)) continue;
      for (const term of terms) {
        if (file.includes(term)) violations.push(file);
      }

      const content = readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const [lineIndex, line] of lines.entries()) {
        for (const term of terms) {
          if (line.includes(term)) violations.push(`${file}:${lineIndex + 1}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
