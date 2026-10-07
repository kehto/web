import { describe, expect, it, vi } from 'vitest';

import {
  bindRuntimeTabBlossomServers,
  createPajaShareUrl,
  parseRuntimeTabsSnapshot,
  resolvedTargetKey,
  resolvedTargetTitle,
  runtimeTabGenerationId,
  snapshotRuntimeTabs,
} from './browser-runtime-tabs.js';
import { createPajaLocalTarget } from './local-target.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';

describe('@kehto/paja runtime tabs', () => {
  it('builds clean share links for naddr, nevent, and fallback pointers', () => {
    expect(createPajaShareUrl(' naddr1test ', 'https://kehto.github.io/web/paja/?old=1#ignored'))
      .toBe('https://kehto.github.io/web/paja/?naddr=naddr1test');
    expect(createPajaShareUrl('nevent1test', 'https://kehto.github.io/web/paja/'))
      .toBe('https://kehto.github.io/web/paja/?nevent=nevent1test');
    expect(createPajaShareUrl('custom pointer', 'https://example.test/paja/'))
      .toBe('https://example.test/paja/?pointer=custom+pointer');
  });

  it('serializes open pointer tabs with the active tab index', () => {
    const state = {
      activeTabId: 'tab-2',
      tabs: [
        { id: 'tab-1', pointerValue: 'naddr1one' },
        { id: 'tab-2', pointerValue: 'nevent1two' },
      ],
    };

    expect(snapshotRuntimeTabs(state)).toEqual({
      version: 1,
      pointers: ['naddr1one', 'nevent1two'],
      activeIndex: 1,
    });
  });

  it('parses only valid persisted runtime tab snapshots', () => {
    const valid = JSON.stringify({
      version: 1,
      pointers: [' naddr1one ', '', 42, 'nevent1two'],
      activeIndex: 10,
    });

    expect(parseRuntimeTabsSnapshot(valid)).toEqual({
      version: 1,
      pointers: ['naddr1one', 'nevent1two'],
      activeIndex: 1,
    });
    expect(parseRuntimeTabsSnapshot('{bad json')).toBeNull();
    expect(parseRuntimeTabsSnapshot(JSON.stringify({ version: 2, pointers: ['naddr1one'] }))).toBeNull();
    expect(parseRuntimeTabsSnapshot(JSON.stringify({ version: 1, pointers: [] }))).toBeNull();
  });

  it('keys retained readiness to the exact tab generation rather than the pointer descriptor', () => {
    expect(runtimeTabGenerationId({ id: 'tab-3', generation: 7 })).toBe('tab-3:7');
    expect(runtimeTabGenerationId({ id: 'tab-3', generation: 8 })).toBe('tab-3:8');
  });

  it('binds verified pointer servers to the exact runtime window before navigation', () => {
    const setWindowBlossomServers = vi.fn();

    bindRuntimeTabBlossomServers(
      { setWindowBlossomServers },
      'paja-window:tab-2:4',
      { blossomServers: ['https://pointer.example'] },
    );

    expect(setWindowBlossomServers).toHaveBeenCalledWith(
      'paja-window:tab-2:4',
      ['https://pointer.example'],
    );
  });
  it('leaves local-file tabs out of persistence and counts the active index among pointer tabs', () => {
    expect(snapshotRuntimeTabs({
      activeTabId: 'tab-3',
      tabs: [
        { id: 'tab-1', pointerValue: '' },
        { id: 'tab-2', pointerValue: 'naddr1one' },
        { id: 'tab-3', pointerValue: 'nevent1two' },
      ],
    })).toEqual({ version: 1, pointers: ['naddr1one', 'nevent1two'], activeIndex: 1 });
    expect(snapshotRuntimeTabs({
      activeTabId: 'tab-1',
      tabs: [{ id: 'tab-1', pointerValue: '' }, { id: 'tab-2', pointerValue: 'naddr1one' }],
    })).toEqual({ version: 1, pointers: ['naddr1one'], activeIndex: 0 });
    expect(snapshotRuntimeTabs({ activeTabId: 'tab-1', tabs: [{ id: 'tab-1', pointerValue: '' }] })).toBeNull();
  });

  it('keys and titles local-file tabs by file identity, separate from pointer keys', async () => {
    const local = await createPajaLocalTarget({ name: 'feed.html', text: '<!doctype html><p>feed</p>' });
    const pointer = {
      event: { kind: 35_129, pubkey: 'a'.repeat(64), tags: [['title', 'Feed']] },
      manifest: { title: 'Feed' },
      dTag: 'local-feed',
      aggregateHash: local.aggregateHash,
    } as unknown as PajaResolvedPointer;

    expect(resolvedTargetKey(local)).toBe(`local:local-feed:${local.aggregateHash}`);
    expect(resolvedTargetKey(pointer)).toBe(`35129:${'a'.repeat(64)}:local-feed:${local.aggregateHash}`);
    expect(resolvedTargetTitle(local)).toBe('feed.html');
    expect(resolvedTargetTitle(pointer)).toBe('Feed');
  });

  it('does not bind Blossom servers for local-file tabs', async () => {
    const setWindowBlossomServers = vi.fn();
    const local = await createPajaLocalTarget({ name: 'index.html', text: '<p>local</p>' });

    bindRuntimeTabBlossomServers({ setWindowBlossomServers }, 'paja-window:tab-1:1', local);

    expect(setWindowBlossomServers).not.toHaveBeenCalled();
  });
});
