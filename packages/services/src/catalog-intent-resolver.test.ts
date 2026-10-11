import { describe, expect, it, vi } from 'vitest';
import { createCatalogIntentResolver, type IntentCatalogEntry } from './catalog-intent-resolver.js';
import type { IntentRequest } from './intent-types.js';

const OPEN = 'napplet:note/open';
const REQUEST: IntentRequest = { archetype: 'note', action: 'open', convention: OPEN };
const CATALOG: readonly IntentCatalogEntry[] = [
  { id: 'nip5d:35129:aa:primary', archetypes: { note: { contracts: [{ convention: OPEN, params: ['event', 'relay'] }] } } },
  { id: 'nip5d:35129:bb:alternate', archetypes: { note: { contracts: [{ convention: OPEN, params: [] }] } } },
];

function resolver(overrides: Partial<Parameters<typeof createCatalogIntentResolver>[0]> = {}) {
  const accept = vi.fn(() => ({ completion: Promise.resolve() }));
  return {
    accept,
    resolver: createCatalogIntentResolver({ loadCatalog: () => CATALOG, targets: { accept }, ...overrides }),
  };
}

describe('createCatalogIntentResolver', () => {
  it('exposes exact contracts and their ordered advertised params', async () => {
    const { resolver: subject } = resolver({ getDefaultHandler: () => CATALOG[0].id });
    await expect(subject.available('note')).resolves.toEqual({
      archetype: 'note', available: true, hasDefault: true,
      candidates: [
        { id: CATALOG[0].id, actions: ['open'], conventions: [OPEN], contracts: [{ convention: OPEN, params: ['event', 'relay'] }], isDefault: true },
        { id: CATALOG[1].id, actions: ['open'], conventions: [OPEN], contracts: [{ convention: OPEN, params: [] }] },
      ],
    });
  });

  it('accepts retained delivery before completion and never exposes target internals', async () => {
    let rejectCompletion!: (error: Error) => void;
    const completion = new Promise<void>((_resolve, reject) => { rejectCompletion = reject; });
    const accept = vi.fn(() => ({ completion }));
    const subject = createCatalogIntentResolver({ loadCatalog: () => [CATALOG[0]], targets: { accept } });
    await expect(subject.invoke(REQUEST, { sender: 'nip5d:35129:cc:source', sourceWindowId: 'source-window' })).resolves.toEqual({
      ok: true, archetype: 'note', action: 'open', convention: OPEN, handler: CATALOG[0].id,
    });
    expect(accept).toHaveBeenCalledWith(expect.objectContaining({ sender: 'nip5d:35129:cc:source', sourceWindowId: 'source-window', handler: CATALOG[0].id }));
    rejectCompletion(new Error('target failed after acceptance'));
  });

  it('authorizes an explicit target with the authenticated source window context only', async () => {
    const authorize = vi.fn(() => true);
    const { resolver: subject } = resolver({ authorizeExplicitHandler: authorize });
    await expect(subject.invoke(
      { ...REQUEST, handler: CATALOG[1].id },
      { sender: 'launcher-catalog', sourceWindowId: 'launcher-window-2' },
    )).resolves.toMatchObject({ ok: true, handler: CATALOG[1].id });
    expect(authorize).toHaveBeenCalledWith(
      'launcher-catalog', CATALOG[1].id, expect.any(Object), expect.any(Object),
      { sender: 'launcher-catalog', sourceWindowId: 'launcher-window-2' },
    );
  });

  it('honors explicit choice, default, recommendation, then compatible fallback', async () => {
    const explicit = resolver({ authorizeExplicitHandler: () => true });
    await expect(explicit.resolver.invoke({ ...REQUEST, handler: CATALOG[1].id }, { sender: 'source' })).resolves.toMatchObject({ ok: true, handler: CATALOG[1].id });
    await expect(explicit.resolver.invoke({ ...REQUEST, handler: 'missing' }, { sender: 'source' })).resolves.toEqual({ ok: false, error: 'invoke rejected' });

    const defaulted = resolver({ getDefaultHandler: () => CATALOG[1].id, resolveHandlerHint: () => CATALOG[0].id });
    await expect(defaulted.resolver.invoke({ ...REQUEST, handlerHint: { address: `35129:${'a'.repeat(64)}:chosen` } }, { sender: 'source' })).resolves.toMatchObject({ ok: true, handler: CATALOG[1].id });

    const recommended = resolver({ resolveHandlerHint: () => CATALOG[1].id });
    await expect(recommended.resolver.invoke({ ...REQUEST, handlerHint: { address: `35129:${'a'.repeat(64)}:chosen` } }, { sender: 'source' })).resolves.toMatchObject({ ok: true, handler: CATALOG[1].id });

    const fallback = createCatalogIntentResolver({ loadCatalog: () => [CATALOG[0]], targets: { accept: vi.fn(() => ({ completion: Promise.resolve() })) } });
    await expect(fallback.invoke(REQUEST, { sender: 'source' })).resolves.toMatchObject({ ok: true, handler: CATALOG[0].id });
  });

  it('treats absent handler and handler default identically after no default exists', async () => {
    const recommended = resolver({ resolveHandlerHint: () => CATALOG[1].id });
    const hinted = { handlerHint: { address: `35129:${'a'.repeat(64)}:chosen` } };
    await expect(recommended.resolver.invoke({ ...REQUEST, ...hinted }, { sender: 'source' })).resolves.toMatchObject({ ok: true, handler: CATALOG[1].id });
    await expect(recommended.resolver.invoke({ ...REQUEST, handler: 'default', ...hinted }, { sender: 'source' })).resolves.toMatchObject({ ok: true, handler: CATALOG[1].id });

    const fallback = createCatalogIntentResolver({
      loadCatalog: () => [CATALOG[0]],
      targets: { accept: vi.fn(() => ({ completion: Promise.resolve() })) },
    });
    await expect(fallback.invoke(REQUEST, { sender: 'source' })).resolves.toMatchObject({ ok: true, handler: CATALOG[0].id });
    await expect(fallback.invoke({ ...REQUEST, handler: 'default' }, { sender: 'source' })).resolves.toMatchObject({ ok: true, handler: CATALOG[0].id });
  });

  it('fails closed on non-exact conventions and user cancellation', async () => {
    const { resolver: subject, accept } = resolver({ chooseHandler: () => undefined });
    await expect(subject.invoke({ ...REQUEST, convention: 'napplet:note/open?x=1' }, { sender: 'source' })).resolves.toEqual({ ok: false, error: 'invalid convention' });
    await expect(subject.invoke({ ...REQUEST, handler: 'choose' }, { sender: 'source' })).resolves.toEqual({ ok: false, error: 'user cancelled' });
    expect(accept).not.toHaveBeenCalled();
  });
});
