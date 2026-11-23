import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MOCK_DOMAIN_ALREADY_DEFINED,
  MOCK_NAP_REGISTRY,
  MOCK_REGISTRY_DUPLICATE_DOMAIN,
  createMockNapServices,
  findMockDomain,
  installMockServices,
} from './index.js';

afterEach(() => vi.restoreAllMocks());

describe('installMockServices', () => {
  it('fills only the domains the host leaves undefined and keeps the real handler', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const real = { descriptor: { name: 'torrent', version: 'real' }, handleMessage() {} };
    const services: Record<string, unknown> = { torrent: real };
    const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { only: ['torrent', 'git'] });

    const result = installMockServices(services, mocks.services);

    expect(result).toEqual({ installed: ['git'], skipped: ['torrent'] });
    expect(services.torrent).toBe(real);
    expect(services.git).toBe(mocks.services.git);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]![0]);
    expect(message).toContain(`[${MOCK_DOMAIN_ALREADY_DEFINED}]`);
    expect(message).toContain('"torrent"');
    expect(message).toContain('`except` or `only`');
  });

  it('stays quiet when nothing collides and reports collisions through onCollision instead of console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { only: ['torrent', 'git'] });

    installMockServices<unknown>({}, mocks.services);
    expect(warn).not.toHaveBeenCalled();

    const collisions: string[] = [];
    installMockServices<unknown>({ git: {} }, mocks.services, { onCollision: (domain) => collisions.push(domain) });
    expect(collisions).toEqual(['git']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('treats an explicitly undefined slot as free', () => {
    const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { only: ['git'] });
    const services: Record<string, unknown> = { git: undefined };
    expect(installMockServices(services, mocks.services).installed).toEqual(['git']);
    expect(services.git).toBe(mocks.services.git);
  });
});

describe('createMockNapServices duplicate registry entries', () => {
  it('keeps the first entry and warns instead of throwing or overwriting', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const torrent = findMockDomain('torrent')!;
    const first = vi.fn(torrent.create!);
    const second = vi.fn(torrent.create!);

    const mocks = createMockNapServices([{ ...torrent, create: first }, { ...torrent, create: second }]);

    expect(mocks.domains).toEqual(['torrent']);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain(`[${MOCK_REGISTRY_DUPLICATE_DOMAIN}]`);
  });

  it('the shipped registry has no duplicate domains, so it never warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createMockNapServices(MOCK_NAP_REGISTRY);
    expect(warn).not.toHaveBeenCalled();
  });
});
