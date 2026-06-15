/**
 * index.test.ts — Unit tests for the NIP-65 relay-list parser + registry.
 *
 * Covers the pure parser (`parseNip65RelayList`, `selectWriteRelays`,
 * `selectReadRelays`) and the closure-scoped `createNip65Registry` registry,
 * including the multi-instance isolation guarantee that distinguishes this
 * module from hyprgate's module-globals reference implementation.
 */

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import {
  parseNip65RelayList,
  selectWriteRelays,
  selectReadRelays,
  createNip65Registry,
  type RelayEntry,
} from './index.js';

function makeKind10002(pubkey: string, rTags: string[][]): NostrEvent {
  return {
    id: 'event-' + Math.random().toString(36).slice(2),
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 10002,
    tags: rTags,
    content: '',
    sig: 'sig',
  };
}

describe('parseNip65RelayList', () => {
  it('treats an unmarked r-tag as read AND write', () => {
    const entries = parseNip65RelayList(makeKind10002('a', [['r', 'wss://both.example']]));
    expect(entries).toEqual<RelayEntry[]>([{ url: 'wss://both.example', read: true, write: true }]);
  });

  it('honors read and write markers', () => {
    const entries = parseNip65RelayList(
      makeKind10002('a', [
        ['r', 'wss://read.example', 'read'],
        ['r', 'wss://write.example', 'write'],
      ]),
    );
    expect(entries).toEqual<RelayEntry[]>([
      { url: 'wss://read.example', read: true, write: false },
      { url: 'wss://write.example', read: false, write: true },
    ]);
  });

  it('ignores non-r tags and r-tags without a URL', () => {
    const entries = parseNip65RelayList(
      makeKind10002('a', [
        ['p', 'somepubkey'],
        ['r'],
        ['r', ''],
        ['r', 'wss://kept.example'],
        ['t', 'topic'],
      ]),
    );
    expect(entries).toEqual<RelayEntry[]>([{ url: 'wss://kept.example', read: true, write: true }]);
  });

  it('treats an unknown marker as unmarked (read + write)', () => {
    const entries = parseNip65RelayList(makeKind10002('a', [['r', 'wss://x.example', 'bogus']]));
    expect(entries).toEqual<RelayEntry[]>([{ url: 'wss://x.example', read: true, write: true }]);
  });

  it('preserves tag order and duplicate URLs', () => {
    const entries = parseNip65RelayList(
      makeKind10002('a', [
        ['r', 'wss://dup.example', 'read'],
        ['r', 'wss://dup.example', 'write'],
      ]),
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ url: 'wss://dup.example', read: true, write: false });
    expect(entries[1]).toEqual({ url: 'wss://dup.example', read: false, write: true });
  });
});

describe('selectWriteRelays / selectReadRelays', () => {
  const entries: RelayEntry[] = [
    { url: 'wss://both.example', read: true, write: true },
    { url: 'wss://read.example', read: true, write: false },
    { url: 'wss://write.example', read: false, write: true },
    { url: 'wss://both.example', read: true, write: true }, // duplicate
  ];

  it('selectWriteRelays returns de-duplicated write URLs in order', () => {
    expect(selectWriteRelays(entries)).toEqual(['wss://both.example', 'wss://write.example']);
  });

  it('selectReadRelays returns de-duplicated read URLs in order', () => {
    expect(selectReadRelays(entries)).toEqual(['wss://both.example', 'wss://read.example']);
  });
});

describe('createNip65Registry', () => {
  it('ingest() stores by event.pubkey and returns parsed entries', () => {
    const registry = createNip65Registry();
    const entries = registry.ingest(makeKind10002('alice', [['r', 'wss://alice.example']]));
    expect(entries).toEqual([{ url: 'wss://alice.example', read: true, write: true }]);
    expect(registry.has('alice')).toBe(true);
    expect(registry.getRelayList('alice')).toEqual(entries);
  });

  it('ingest() overwrites a prior list (replaceable semantics)', () => {
    const registry = createNip65Registry();
    registry.ingest(makeKind10002('alice', [['r', 'wss://old.example']]));
    registry.ingest(makeKind10002('alice', [['r', 'wss://new.example', 'write']]));
    expect(registry.getRelayList('alice')).toEqual([{ url: 'wss://new.example', read: false, write: true }]);
  });

  it('resolveOutboxRelays() unions write relays across authors, de-duplicated', () => {
    const registry = createNip65Registry();
    registry.ingest(
      makeKind10002('alice', [
        ['r', 'wss://shared.example'],
        ['r', 'wss://alice-write.example', 'write'],
        ['r', 'wss://alice-read.example', 'read'],
      ]),
    );
    registry.ingest(
      makeKind10002('bob', [
        ['r', 'wss://shared.example'],
        ['r', 'wss://bob-write.example', 'write'],
      ]),
    );
    expect(registry.resolveOutboxRelays(['alice', 'bob'])).toEqual([
      'wss://shared.example',
      'wss://alice-write.example',
      'wss://bob-write.example',
    ]);
  });

  it('resolveReadRelays() unions read relays across authors, de-duplicated', () => {
    const registry = createNip65Registry();
    registry.ingest(makeKind10002('alice', [['r', 'wss://a.example', 'read'], ['r', 'wss://w.example', 'write']]));
    registry.ingest(makeKind10002('bob', [['r', 'wss://b.example']]));
    expect(registry.resolveReadRelays(['alice', 'bob'])).toEqual(['wss://a.example', 'wss://b.example']);
  });

  it('returns [] for unknown authors and empty input', () => {
    const registry = createNip65Registry();
    expect(registry.resolveOutboxRelays(['nobody'])).toEqual([]);
    expect(registry.resolveOutboxRelays([])).toEqual([]);
    expect(registry.getRelayList('nobody')).toBeUndefined();
    expect(registry.has('nobody')).toBe(false);
  });

  it('delete() and clear() remove stored lists', () => {
    const registry = createNip65Registry();
    registry.ingest(makeKind10002('alice', [['r', 'wss://a.example']]));
    registry.ingest(makeKind10002('bob', [['r', 'wss://b.example']]));
    expect(registry.delete('alice')).toBe(true);
    expect(registry.delete('alice')).toBe(false);
    expect(registry.has('alice')).toBe(false);
    registry.clear();
    expect(registry.has('bob')).toBe(false);
  });

  it('getRelayList() returns a defensive copy (mutation does not leak into the registry)', () => {
    const registry = createNip65Registry();
    registry.ingest(makeKind10002('alice', [['r', 'wss://a.example']]));
    const got = registry.getRelayList('alice')!;
    got[0].url = 'wss://tampered.example';
    expect(registry.getRelayList('alice')![0].url).toBe('wss://a.example');
  });

  it('two registries share no state (closure-scoped, not module globals)', () => {
    const a = createNip65Registry();
    const b = createNip65Registry();
    a.ingest(makeKind10002('alice', [['r', 'wss://only-in-a.example']]));
    expect(a.resolveOutboxRelays(['alice'])).toEqual(['wss://only-in-a.example']);
    expect(b.has('alice')).toBe(false);
    expect(b.resolveOutboxRelays(['alice'])).toEqual([]);
  });
});
