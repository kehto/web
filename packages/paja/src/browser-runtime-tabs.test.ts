import { describe, expect, it, vi } from 'vitest';

import {
  bindRuntimeTabBlossomServers,
  createPajaShareUrl,
  parseRuntimeTabsSnapshot,
  runtimeTabGenerationId,
  snapshotRuntimeTabs,
} from './browser-runtime-tabs.js';

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
});
