import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recordInstalledIntentSurface } from './browser-intent-host.js';
import type { PajaBrowserState } from './browser-host.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';

function resolvedPointer(manifest: {
  requires: string[];
  archetypes: Array<{ slug: string; convention: string }>;
}): PajaResolvedPointer {
  return {
    pointer: { type: 'naddr', value: 'naddr-fixture', identifier: 'profile-target', pubkey: 'a'.repeat(64), kind: 35_129, relays: [] },
    event: { id: 'b'.repeat(64), pubkey: 'a'.repeat(64), created_at: 1, kind: 35_129, tags: [], content: '', sig: 'c'.repeat(128) },
    relays: [],
    blossomServers: [],
    dTag: 'profile-target',
    aggregateHash: 'd'.repeat(64),
    indexHtml: '',
    manifest: {
      kind: 35_129,
      pubkey: 'a'.repeat(64),
      dTag: 'profile-target',
      aggregateHash: 'd'.repeat(64),
      paths: [],
      servers: [],
      requires: manifest.requires,
      archetypes: manifest.archetypes,
    },
  } as PajaResolvedPointer;
}

function browserState(): PajaBrowserState {
  return { messageLog: [] } as unknown as PajaBrowserState;
}

describe('recordInstalledIntentSurface', () => {
  beforeEach(() => {
    // `appendPajaMessageLog` renders into `#message-log`; a null container
    // short-circuits the render so the log row is still recorded.
    vi.stubGlobal('document', { getElementById: () => null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('warns and records intentEligible: false for archetypes without the inc requirement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const target = resolvedPointer({
      requires: ['theme'],
      archetypes: [{ slug: 'note', convention: 'napplet:note/open' }],
    });
    const state = browserState();

    recordInstalledIntentSurface(state, target);

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('NOT intent-eligible'),
      'profile-target',
    );
    const entry = state.messageLog.at(-1)!;
    expect(entry.type).toBe('paja.pointer.resolved');
    expect(JSON.parse(entry.preview)).toEqual({
      type: 'paja.pointer.resolved',
      dTag: 'profile-target',
      aggregateHash: 'd'.repeat(64),
      archetypes: [{ slug: 'note', convention: 'napplet:note/open' }],
      requires: ['theme'],
      intentEligible: false,
    });
  });

  it('records intentEligible: true without warning when inc is required', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const target = resolvedPointer({
      requires: ['inc', 'theme'],
      archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }],
    });
    const state = browserState();

    recordInstalledIntentSurface(state, target);

    expect(warn).not.toHaveBeenCalled();
    const entry = state.messageLog.at(-1)!;
    expect(JSON.parse(entry.preview)).toMatchObject({ intentEligible: true });
  });

  it('does not warn when no archetypes are declared', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const target = resolvedPointer({ requires: ['intent'], archetypes: [] });
    const state = browserState();

    recordInstalledIntentSurface(state, target);

    expect(warn).not.toHaveBeenCalled();
    const entry = state.messageLog.at(-1)!;
    expect(JSON.parse(entry.preview)).toMatchObject({ intentEligible: false });
  });
});
