import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { checkNpmPublication, publicPackageTargets } from '../../scripts/check-npm-publication.mjs';

const target = { name: '@kehto/mocks', version: '0.1.4' };
const published = () => Response.json(target);

describe('public npm release verification', () => {
  test('reads public Kehto targets and excludes private workspaces', () => {
    const directory = mkdtempSync(join(tmpdir(), 'kehto-npm-targets-'));
    try {
      for (const [slug, manifest] of [
        ['mocks', target],
        ['private', { name: '@kehto/private', version: '1.0.0', private: true }],
        ['fixture', { name: '@test/fixture', version: '1.0.0' }],
      ] as const) {
        mkdirSync(join(directory, slug));
        writeFileSync(join(directory, slug, 'package.json'), JSON.stringify(manifest));
      }
      expect(publicPackageTargets(directory)).toEqual([target]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('accepts an exact public version without waiting', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(published());
    const wait = vi.fn();
    await checkNpmPublication([target], { fetchImpl, wait });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://registry.npmjs.org/@kehto/mocks/0.1.4');
    expect(wait).not.toHaveBeenCalled();
  });

  test('retries propagation failures without rechecking versions already public', async () => {
    const other = { name: '@kehto/rate-limit', version: '0.2.0' };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(published())
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json(other));
    const wait = vi.fn();
    await checkNpmPublication([target, other], { fetchImpl, wait, attempts: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[2][0]).toContain('@kehto/rate-limit/0.2.0');
    expect(wait).toHaveBeenCalledExactlyOnceWith(5_000);
  });

  test('fails unavailable or staged versions with actionable approval guidance', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(checkNpmPublication([target], { fetchImpl, attempts: 1 }))
      .rejects.toThrow('@kehto/mocks@0.1.4 (HTTP 404)');
    await expect(checkNpmPublication([target], { fetchImpl, attempts: 1 }))
      .rejects.toThrow('approve pending versions with 2FA');
  });

  test('rejects wrong metadata and reports network failures', async () => {
    await expect(checkNpmPublication([target], {
      fetchImpl: vi.fn().mockResolvedValue(Response.json({ ...target, version: '0.1.0' })),
      attempts: 1,
    })).rejects.toThrow('registry returned a different package/version');
    await expect(checkNpmPublication([target], {
      fetchImpl: vi.fn().mockRejectedValue(new Error('connection failed')),
      attempts: 1,
    })).rejects.toThrow('connection failed');
  });
});
