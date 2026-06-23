import { describe, expect, test } from 'vitest';

import { selectE2eTests } from '../../scripts/select-e2e-tests.mjs';

describe('selectE2eTests', () => {
  test('skips docs and planning only changes', () => {
    const result = selectE2eTests([
      'README.md',
      'docs/packages/runtime.md',
      '.planning/quick/example/PLAN.md',
      '.changeset/example.md',
    ]);

    expect(result.runE2e).toBe(false);
    expect(result.specs).toEqual([]);
  });

  test('runs only directly changed e2e specs', () => {
    const result = selectE2eTests([
      'tests/e2e/nap-resource.spec.ts',
      'tests/e2e/theme-broadcast.spec.ts',
    ]);

    expect(result.runE2e).toBe(true);
    expect(result.specs).toEqual([
      'tests/e2e/nap-resource.spec.ts',
      'tests/e2e/theme-broadcast.spec.ts',
    ]);
  });

  test('narrows paja package changes to the paja browser spec', () => {
    const result = selectE2eTests([
      'packages/paja/src/server.ts',
    ]);

    expect(result.runE2e).toBe(true);
    expect(result.specs).toEqual(['tests/e2e/paja-single-window.spec.ts']);
  });

  test('narrows relay domain changes to relay-related browser specs', () => {
    const result = selectE2eTests([
      'packages/services/src/relay-pool-service.ts',
    ]);

    expect(result.runE2e).toBe(true);
    expect(result.specs).toContain('tests/e2e/nap-relay.spec.ts');
    expect(result.specs).toContain('tests/e2e/relay-subscribe.spec.ts');
    expect(result.specs).not.toContain('tests/e2e/paja-single-window.spec.ts');
  });

  test('runs the full suite for shared Playwright config changes', () => {
    const result = selectE2eTests([
      'playwright.config.ts',
    ]);

    expect(result.runE2e).toBe(true);
    expect(result.all).toBe(true);
    expect(result.specArgs).toBe('tests/e2e');
  });

  test('runs the full suite for unclassified runtime changes', () => {
    const result = selectE2eTests([
      'packages/runtime/src/session.ts',
    ]);

    expect(result.runE2e).toBe(true);
    expect(result.all).toBe(true);
    expect(result.specArgs).toBe('tests/e2e');
  });
});
