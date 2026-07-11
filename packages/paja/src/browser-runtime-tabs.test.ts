import { describe, expect, it } from 'vitest';

import {
  createPajaShareUrl,
  parseRuntimeTabsSnapshot,
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
});
