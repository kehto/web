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

  test('skips generated Version Packages metadata', () => {
    const result = selectE2eTests([
      'docs/packages/shell.md',
      'packages/paja/jsr.json',
      'packages/shell/CHANGELOG.md',
      'packages/shell/jsr.json',
      'packages/shell/package.json',
    ]);

    expect(result.runE2e).toBe(false);
    expect(result.specs).toEqual([]);
  });

  test('runs only directly changed e2e specs', () => {
    const result = selectE2eTests([
      'tests/e2e/nap-media-player.spec.ts',
      'tests/e2e/nap-theme.spec.ts',
    ]);

    expect(result.runE2e).toBe(true);
    expect(result.specs).toEqual([
      'tests/e2e/nap-media-player.spec.ts',
      'tests/e2e/nap-theme.spec.ts',
    ]);
  });

  test('narrows paja package changes to the Paja host, pointer, and service-flow browser specs', () => {
    const result = selectE2eTests([
      'packages/paja/src/server.ts',
    ]);

    expect(result.runE2e).toBe(true);
    expect(result.specs).toEqual([
      'tests/e2e/paja-cvm.spec.ts',
      'tests/e2e/paja-identity.spec.ts',
      'tests/e2e/paja-relay.spec.ts',
      'tests/e2e/paja-runtime-pointer.spec.ts',
      'tests/e2e/paja-single-window.spec.ts',
      'tests/e2e/paja-storage.spec.ts',
    ]);
  });

  test('routes service-domain changes to the matching Paja service-flow specs', () => {
    expect(selectE2eTests(['packages/services/src/storage-service.ts']).specs).toContain('tests/e2e/paja-storage.spec.ts');
    expect(selectE2eTests(['packages/services/src/cvm-nostr-transport.ts']).specs).toContain('tests/e2e/paja-cvm.spec.ts');
    expect(selectE2eTests(['packages/services/src/identity-service.ts']).specs).toContain('tests/e2e/paja-identity.spec.ts');
    expect(selectE2eTests(['packages/acl/src/check.ts']).specs).toEqual(expect.arrayContaining([
      'tests/e2e/paja-relay.spec.ts',
      'tests/e2e/paja-storage.spec.ts',
    ]));
  });

  test('narrows relay domain changes to relay-related browser specs', () => {
    const result = selectE2eTests([
      'packages/services/src/relay-pool-service.ts',
    ]);

    expect(result.runE2e).toBe(true);
    expect(result.specs).toContain('tests/e2e/nap-relay.spec.ts');
    expect(result.specs).toContain('tests/e2e/paja-relay.spec.ts');
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

  test('never selects specs for the retired playground host', () => {
    const result = selectE2eTests([
      'tests/e2e/playground-usability-controls.spec.ts',
      'tests/e2e/demo-boot.spec.ts',
    ]);

    expect(result.runE2e).toBe(false);
    expect(result.specs).toEqual([]);
  });
});
