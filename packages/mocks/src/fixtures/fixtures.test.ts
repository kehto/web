import { describe, expect, it } from 'vitest';

import { createSeededRng, mockHex, mockPubkey, mockSignature } from '../core/rng.js';
import { LINUX_DISTROS, findLinuxDistro, searchLinuxDistros } from './linux-distros.js';
import { MOCK_ACCOUNTS, MOCK_EVENTS, findMockAccount, matchesNostrFilter, queryNostrEvents } from './nostr.js';

describe('seeded rng and ids', () => {
  it('is deterministic per seed and label', () => {
    expect(createSeededRng(5).hex(16)).toBe(createSeededRng(5).hex(16));
    expect(createSeededRng(5).hex(16)).not.toBe(createSeededRng(6).hex(16));
    expect(mockHex('x')).toBe(mockHex('x'));
    expect(mockPubkey('alice')).toMatch(/^[0-9a-f]{64}$/);
    expect(mockSignature('x')).toMatch(/^[0-9a-f]{128}$/);
    expect(createSeededRng(1).uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('linux distro catalog', () => {
  it('uses placeholder hashes and example mirrors only', () => {
    expect(LINUX_DISTROS.length).toBeGreaterThanOrEqual(8);
    for (const item of LINUX_DISTROS) {
      expect(item.infoHash).toMatch(/^[0-9a-f]{40}$/);
      expect(item.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(item.magnet.startsWith(`magnet:?xt=urn:btih:${item.infoHash}`)).toBe(true);
      expect(item.mirrors.every((url) => /https:\/\/[a-z-]+\.example\.(org|net)\//.test(url))).toBe(true);
    }
  });

  it('finds and searches', () => {
    const debian = findLinuxDistro('debian-12-netinst');
    expect(debian?.distro).toBe('Debian');
    expect(findLinuxDistro(debian!.infoHash)?.id).toBe('debian-12-netinst');
    expect(searchLinuxDistros('arch').map((item) => item.id)).toEqual(['arch-2024-11']);
    expect(searchLinuxDistros('').length).toBe(LINUX_DISTROS.length);
  });
});

describe('nostr fixtures', () => {
  it('provides accounts with profiles, contacts, relay lists, and notes', () => {
    expect(MOCK_ACCOUNTS[0]?.name).toBe('alice');
    expect(findMockAccount('bob')?.pubkey).toBe(findMockAccount(MOCK_ACCOUNTS[1]!.pubkey)?.pubkey);
    const kinds = new Set(MOCK_EVENTS.map((event) => event.kind));
    expect([...kinds].sort((a, b) => a - b)).toEqual([0, 1, 3, 10002]);
    expect(new Set(MOCK_EVENTS.map((event) => event.id)).size).toBe(MOCK_EVENTS.length);
  });

  it('matches and queries with NIP-01 filters', () => {
    const alice = MOCK_ACCOUNTS[0]!;
    const profile = MOCK_EVENTS.find((event) => event.kind === 0 && event.pubkey === alice.pubkey)!;
    expect(matchesNostrFilter(profile, { kinds: [0], authors: [alice.pubkey.slice(0, 8)] })).toBe(true);
    expect(matchesNostrFilter(profile, { '#t': ['linux'] })).toBe(false);
    const notes = queryNostrEvents(MOCK_EVENTS, [{ kinds: [1], '#t': ['linux'], limit: 5 }]);
    expect(notes).toHaveLength(5);
    expect(notes[0]!.created_at).toBeGreaterThanOrEqual(notes[4]!.created_at);
    expect(queryNostrEvents(MOCK_EVENTS, [{ kinds: [3] }, { kinds: [10002] }])).toHaveLength(MOCK_ACCOUNTS.length * 2);
  });
});
