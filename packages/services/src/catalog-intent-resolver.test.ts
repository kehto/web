import { describe, expect, it, vi } from 'vitest';
import type { IntentRequest, IntentResult } from '@napplet/core';
import {
  createCatalogIntentResolver,
  type CatalogIntentResolver,
  type CatalogIntentResolverOptions,
  type IntentCatalogEntry,
  type IntentDispatchParams,
} from './catalog-intent-resolver.js';

const NOTE_OPEN = 'napplet:note/open';
const NOTE_EDIT = 'napplet:note/edit';
const CATALOG: IntentCatalogEntry[] = [
  {
    dTag: 'noteview',
    title: 'Note',
    archetypes: {
      note: {
        actions: ['open', 'edit'],
        conventions: [NOTE_OPEN, NOTE_EDIT],
      },
    },
  },
  {
    dTag: 'notealt',
    title: 'Alt Note',
    archetypes: {
      note: {
        actions: ['open'],
        conventions: [NOTE_OPEN],
      },
    },
  },
];

const REQUEST: IntentRequest = {
  archetype: 'note',
  action: 'open',
  convention: NOTE_OPEN,
};

function makeResolver(options: Partial<CatalogIntentResolverOptions> = {}) {
  const dispatches: IntentDispatchParams[] = [];
  const dispatch = vi.fn(async (params: IntentDispatchParams) => {
    dispatches.push(params);
    return { windowId: 'window-note' };
  });
  const resolver = createCatalogIntentResolver({
    loadCatalog: () => CATALOG,
    targets: { dispatch },
    ...options,
  });
  return { resolver, dispatch, dispatches };
}

function invoke(
  resolver: CatalogIntentResolver,
  request: IntentRequest,
  sender = 'caller',
): Promise<IntentResult> {
  return Promise.resolve(resolver.invoke(request, { sender }));
}

function rejection(
  error: string,
  archetype = 'note',
  action = 'open',
): IntentResult {
  return { ok: false, archetype, action, handled: false, error };
}

describe('createCatalogIntentResolver', () => {
  it('requires catalog and dispatch callbacks', () => {
    // @ts-expect-error runtime guard
    expect(() => createCatalogIntentResolver({ targets: { dispatch() {} } })).toThrow(
      /loadCatalog is required/,
    );
    // @ts-expect-error runtime guard
    expect(() => createCatalogIntentResolver({ loadCatalog: () => [] })).toThrow(
      /targets is required/,
    );
  });

  it('rejects absent archetypes, unsupported actions, and non-exact conventions', async () => {
    const { resolver, dispatch } = makeResolver();
    await expect(invoke(resolver, {
      archetype: 'missing',
      action: 'open',
      convention: 'napplet:missing/open',
    })).resolves.toEqual(rejection('no handler', 'missing'));
    await expect(invoke(resolver, { ...REQUEST, action: 'share' }))
      .resolves.toEqual(rejection('unsupported action', 'note', 'share'));
    await expect(invoke(resolver, { ...REQUEST, convention: `${NOTE_OPEN}?kind=1` }))
      .resolves.toEqual(rejection('unsupported convention'));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('uses defaults, sole compatible candidates, and explicit chooser policy', async () => {
    const defaults = makeResolver({ getDefaultHandler: () => 'notealt' });
    await expect(invoke(defaults.resolver, REQUEST)).resolves.toMatchObject({
      ok: true,
      handled: true,
      handler: 'notealt',
      windowId: 'window-note',
    });

    const sole = makeResolver();
    await expect(invoke(sole.resolver, {
      ...REQUEST,
      action: 'edit',
      convention: NOTE_EDIT,
    })).resolves.toMatchObject({ ok: true, handler: 'noteview' });

    const chooseHandler = vi.fn(() => 'noteview');
    const chosen = makeResolver({ chooseHandler });
    await expect(invoke(chosen.resolver, { ...REQUEST, handler: 'choose' }))
      .resolves.toMatchObject({ ok: true, handler: 'noteview' });
    expect(chooseHandler).toHaveBeenCalledWith(
      'note',
      expect.arrayContaining([
        expect.objectContaining({ dTag: 'noteview' }),
        expect.objectContaining({ dTag: 'notealt' }),
      ]),
      'caller',
    );
  });

  it('rejects ambiguity, cancellation, and unauthorized explicit handlers', async () => {
    await expect(invoke(makeResolver().resolver, REQUEST))
      .resolves.toEqual(rejection('invoke rejected'));
    await expect(invoke(
      makeResolver({ chooseHandler: () => undefined }).resolver,
      { ...REQUEST, handler: 'choose' },
    )).resolves.toEqual(rejection('user cancelled'));
    await expect(invoke(
      makeResolver().resolver,
      { ...REQUEST, handler: 'notealt' },
    )).resolves.toEqual(rejection('invoke rejected'));

    const authorizeExplicitHandler = vi.fn(() => true);
    const allowed = makeResolver({ authorizeExplicitHandler });
    await expect(invoke(allowed.resolver, { ...REQUEST, handler: 'notealt' }))
      .resolves.toMatchObject({ ok: true, handler: 'notealt' });
    expect(authorizeExplicitHandler).toHaveBeenCalledWith(
      'caller',
      'notealt',
      expect.objectContaining(REQUEST),
      expect.objectContaining({ dTag: 'notealt' }),
    );
  });

  it('defaults the action, selects its matching convention, and dispatches immutable attested values', async () => {
    const { resolver, dispatch, dispatches } = makeResolver({
      getDefaultHandler: () => 'noteview',
    });
    const payload = { event: { kind: 1 } };
    const result = await invoke(resolver, {
      archetype: 'note',
      payload,
      behavior: { focus: true, newWindow: true, reuse: false },
    }, 'source-dtag');

    expect(result).toEqual({
      ok: true,
      archetype: 'note',
      action: 'open',
      handled: true,
      handler: 'noteview',
      windowId: 'window-note',
      convention: NOTE_OPEN,
    });
    expect(dispatch).toHaveBeenCalledWith({
      handler: 'noteview',
      sender: 'source-dtag',
      archetype: 'note',
      action: 'open',
      convention: NOTE_OPEN,
      payload,
      behavior: { focus: true, newWindow: true, reuse: false },
    });
    expect(Object.isFrozen(dispatches[0])).toBe(true);
    expect(Object.isFrozen(dispatches[0].behavior)).toBe(true);
  });

  it('turns target failures or invalid target identities into canonical rejections', async () => {
    for (const targets of [
      { dispatch: vi.fn(() => { throw new Error('open failed'); }) },
      { dispatch: vi.fn(async () => ({ windowId: '' })) },
    ]) {
      const resolver = createCatalogIntentResolver({
        loadCatalog: () => CATALOG,
        targets,
        getDefaultHandler: () => 'noteview',
      });
      await expect(invoke(resolver, REQUEST)).resolves.toEqual(rejection('invoke failed'));
    }
  });

  it('reports availability and emits catalog changes', async () => {
    const { resolver } = makeResolver({ getDefaultHandler: () => 'noteview' });
    await expect(resolver.available('note')).resolves.toEqual({
      archetype: 'note',
      available: true,
      candidates: [
        {
          dTag: 'noteview',
          title: 'Note',
          actions: ['open', 'edit'],
          conventions: [NOTE_OPEN, NOTE_EDIT],
          isDefault: true,
        },
        {
          dTag: 'notealt',
          title: 'Alt Note',
          actions: ['open'],
          conventions: [NOTE_OPEN],
        },
      ],
      hasDefault: true,
    });
    await expect(resolver.handlers()).resolves.toHaveLength(1);

    const changed = vi.fn();
    const unsubscribe = resolver.onChanged!(changed);
    resolver.notifyChanged('note');
    await Promise.resolve();
    await Promise.resolve();
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ archetype: 'note' }));
    unsubscribe();
  });
});
