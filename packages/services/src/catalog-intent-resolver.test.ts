/**
 * catalog-intent-resolver.test.ts — NAP-INTENT concrete resolver.
 *
 * Exercises createCatalogIntentResolver: candidate gathering, handler selection
 * (explicit dTag / choose / default / sole-candidate / first-candidate
 * fallback), action + protocol validation and defaulting, window-open failure,
 * availability/handlers reporting, and the onChanged/notifyChanged path.
 */

import { describe, it, expect, vi } from 'vitest';
import { createCatalogIntentResolver } from './catalog-intent-resolver.js';
import type {
  CatalogIntentResolverOptions,
  IntentCatalogEntry,
  IntentOpenParams,
} from './catalog-intent-resolver.js';

const CATALOG: IntentCatalogEntry[] = [
  { dTag: 'noteview', title: 'Note', archetypes: { note: { actions: ['open', 'edit'], protocols: ['NAP-4', 'NAP-7'] } } },
  { dTag: 'notealt', title: 'Alt Note', archetypes: { note: { actions: ['open'], protocols: ['NAP-4'] } } },
  { dTag: 'emojilistr', title: 'Emoji', archetypes: { 'emoji-list': { actions: ['open'], protocols: ['NAP-7'] } } },
];

function makeResolver(opts: Partial<CatalogIntentResolverOptions> = {}) {
  const openCalls: IntentOpenParams[] = [];
  const windows = {
    open: vi.fn((params: IntentOpenParams) => { openCalls.push(params); return { windowId: `win-${params.dTag}` }; }),
  };
  const resolver = createCatalogIntentResolver({
    loadCatalog: () => CATALOG,
    windows,
    ...opts,
  });
  return { resolver, windows, openCalls };
}

describe('createCatalogIntentResolver', () => {
  it('throws when loadCatalog is missing', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => createCatalogIntentResolver({ windows: { open: () => ({ windowId: 'w' }) } })).toThrow(/loadCatalog is required/);
  });

  it('throws when windows controller is missing', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => createCatalogIntentResolver({ loadCatalog: () => [] })).toThrow(/windows is required/);
  });

  describe('invoke', () => {
    it('returns "no handler" when no candidate fulfills the archetype', async () => {
      const { resolver } = makeResolver();
      const result = await resolver.invoke({ archetype: 'missing' }, { windowId: 'caller' });
      expect(result).toMatchObject({ ok: false, handled: false, archetype: 'missing', action: 'open', error: 'no handler' });
    });

    it('routes a single candidate, defaults action to "open" and protocol to the first accepted', async () => {
      const { resolver, openCalls } = makeResolver();
      const result = await resolver.invoke({ archetype: 'emoji-list', payload: { seed: ['x'] } }, { windowId: 'caller' });
      expect(result).toEqual({ ok: true, archetype: 'emoji-list', action: 'open', handled: true, handler: 'emojilistr', windowId: 'win-emojilistr', protocol: 'NAP-7' });
      expect(openCalls[0]).toMatchObject({ dTag: 'emojilistr', action: 'open', protocol: 'NAP-7', payload: { seed: ['x'] }, callerWindowId: 'caller' });
    });

    it('routes to an explicit handler dTag', async () => {
      const { resolver } = makeResolver();
      const result = await resolver.invoke({ archetype: 'note', handler: 'notealt' }, { windowId: 'caller' });
      expect(result).toMatchObject({ ok: true, handler: 'notealt', windowId: 'win-notealt' });
    });

    it('returns "no handler" when an explicit dTag does not fulfill the archetype', async () => {
      const { resolver } = makeResolver();
      const result = await resolver.invoke({ archetype: 'note', handler: 'emojilistr' }, { windowId: 'caller' });
      expect(result).toMatchObject({ ok: false, error: 'no handler' });
    });

    it('honors the user default handler among multiple candidates', async () => {
      const { resolver } = makeResolver({ getDefaultHandler: (a) => (a === 'note' ? 'notealt' : undefined) });
      const result = await resolver.invoke({ archetype: 'note' }, { windowId: 'caller' });
      expect(result).toMatchObject({ ok: true, handler: 'notealt' });
    });

    it('prompts the chooser when no default exists for multiple candidates', async () => {
      const chooseHandler = vi.fn(() => 'noteview');
      const { resolver } = makeResolver({ chooseHandler });
      const result = await resolver.invoke({ archetype: 'note' }, { windowId: 'caller' });
      expect(chooseHandler).toHaveBeenCalledWith('note', expect.any(Array), 'caller');
      expect(result).toMatchObject({ ok: true, handler: 'noteview' });
    });

    it('returns "user cancelled" when the chooser is dismissed', async () => {
      const { resolver } = makeResolver({ chooseHandler: () => undefined });
      const result = await resolver.invoke({ archetype: 'note', handler: 'choose' }, { windowId: 'caller' });
      expect(result).toMatchObject({ ok: false, error: 'user cancelled' });
    });

    it('falls back to the first candidate when ambiguous and no chooser is wired', async () => {
      const { resolver } = makeResolver();
      const result = await resolver.invoke({ archetype: 'note' }, { windowId: 'caller' });
      expect(result).toMatchObject({ ok: true, handler: 'noteview' });
    });

    it('rejects an action the resolved handler does not support', async () => {
      const { resolver } = makeResolver();
      const result = await resolver.invoke({ archetype: 'note', action: 'edit', handler: 'notealt' }, { windowId: 'caller' });
      expect(result).toMatchObject({ ok: false, action: 'edit', error: 'unsupported action' });
    });

    it('rejects a protocol the resolved handler does not accept', async () => {
      const { resolver } = makeResolver();
      const result = await resolver.invoke({ archetype: 'note', protocol: 'NAP-99', handler: 'notealt' }, { windowId: 'caller' });
      expect(result).toMatchObject({ ok: false, error: 'unsupported protocol' });
    });

    it('uses the archetype recommended default protocol when the caller omits one', async () => {
      const { resolver, openCalls } = makeResolver({ defaultProtocol: (a) => (a === 'note' ? 'NAP-7' : undefined) });
      const result = await resolver.invoke({ archetype: 'note', handler: 'noteview' }, { windowId: 'caller' });
      expect(result).toMatchObject({ ok: true, protocol: 'NAP-7' });
      expect(openCalls[0].protocol).toBe('NAP-7');
    });

    it('returns "invoke failed" when the window controller throws', async () => {
      const { resolver } = makeResolver({ windows: { open: () => { throw new Error('no slot'); } } });
      const result = await resolver.invoke({ archetype: 'emoji-list' }, { windowId: 'caller' });
      expect(result).toMatchObject({ ok: false, error: 'invoke failed' });
    });
  });

  describe('available / handlers', () => {
    it('reports candidates and default state for an archetype', async () => {
      const { resolver } = makeResolver({ getDefaultHandler: () => 'noteview' });
      const availability = await resolver.available('note');
      expect(availability.available).toBe(true);
      expect(availability.candidates.map((c) => c.dTag)).toEqual(['noteview', 'notealt']);
      expect(availability.candidates.find((c) => c.dTag === 'noteview')?.isDefault).toBe(true);
      expect(availability.hasDefault).toBe(true);
    });

    it('reports unavailable for an unknown archetype', async () => {
      const { resolver } = makeResolver();
      const availability = await resolver.available('nope');
      expect(availability).toMatchObject({ archetype: 'nope', available: false, candidates: [], hasDefault: false });
    });

    it('lists availability for every archetype in the catalog', async () => {
      const { resolver } = makeResolver();
      const all = await resolver.handlers();
      expect(all.map((a) => a.archetype).sort()).toEqual(['emoji-list', 'note']);
    });
  });

  describe('onChanged / notifyChanged', () => {
    it('notifies subscribed listeners with recomputed availability', async () => {
      const { resolver } = makeResolver({ getDefaultHandler: () => 'noteview' });
      const seen: string[] = [];
      resolver.onChanged?.((a) => seen.push(a.archetype));
      resolver.notifyChanged('note');
      await Promise.resolve();
      await Promise.resolve();
      expect(seen).toEqual(['note']);
    });

    it('stops notifying after unsubscribe', async () => {
      const { resolver } = makeResolver();
      const seen: string[] = [];
      const off = resolver.onChanged!((a) => seen.push(a.archetype));
      off();
      resolver.notifyChanged('note');
      await Promise.resolve();
      await Promise.resolve();
      expect(seen).toEqual([]);
    });
  });
});
