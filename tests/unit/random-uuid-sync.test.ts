import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * kehto/web#351: `@kehto/services` cannot import the `@kehto/shell` UUID
 * helper without a new package edge, so it carries a private twin. The two
 * bodies encode one entropy policy (native randomUUID, then getRandomValues,
 * never weak randomness) and must not drift.
 */
function body(pkg: 'shell' | 'services'): string {
  const source = readFileSync(join(process.cwd(), `packages/${pkg}/src/random-uuid.ts`), 'utf8');
  const start = source.indexOf('export function randomUUID(): string {');
  expect(start).toBeGreaterThan(-1);
  return source.slice(start).replaceAll(`@kehto/${pkg}`, '@kehto/<pkg>');
}

describe('host UUID helper copies', () => {
  it('keeps the services twin identical to the shell export', () => {
    expect(body('services')).toBe(body('shell'));
  });

  it('never reaches for weak randomness or a timestamp', () => {
    expect(body('shell')).not.toMatch(/Math\.random|Date\.now/);
  });
});
