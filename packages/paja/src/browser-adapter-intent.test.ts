import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import { buildShellCapabilities } from '@kehto/shell';
import type { PajaResolvedPointer } from './runtime-resolver.js';
import { createPajaAdapter } from './browser-adapter.js';
import { BrowserIntentController } from './browser-intent-controller.js';
import { InstalledNappletCatalog } from './installed-napplet-catalog.js';
import { normalizePajaSimulation } from './simulation.js';
import type { PajaHostConfig } from './options.js';

const REQUEST = {
  archetype: 'profile',
  action: 'open',
  convention: 'napplet:profile/open',
};
const CATALOG_ID = `nip5d:35129:${'a'.repeat(64)}:profile-viewer`;

function resolvedNapplet(dTag = 'profile-viewer'): PajaResolvedPointer {
  return {
    pointer: {
      type: 'naddr',
      value: `naddr1${dTag}`,
      identifier: dTag,
      pubkey: 'a'.repeat(64),
      kind: 35_129,
      relays: ['wss://relay.example'],
    },
    event: {
      id: 'b'.repeat(64),
      pubkey: 'a'.repeat(64),
      created_at: 1,
      kind: 35_129,
      tags: [],
      content: '',
      sig: 'c'.repeat(128),
    },
    relays: ['wss://relay.example'],
    blossomServers: [],
    dTag,
    aggregateHash: 'd'.repeat(64),
    indexHtml: '<main>verified</main>',
    manifest: {
      kind: 35_129,
      pubkey: 'a'.repeat(64),
      dTag,
      aggregateHash: 'd'.repeat(64),
      paths: [],
      servers: [],
      requires: ['inc'],
      title: dTag,
      catalogId: `nip5d:35129:${'a'.repeat(64)}:${dTag}`,
      archetypes: [{ slug: 'profile', convention: 'napplet:profile/open', params: [] }],
    },
  };
}

function makeAdapter(policy: {
  getDefaultHandler?: (archetype: string) => string | undefined;
  chooseHandler?: (archetype: string, candidates: readonly import('@kehto/services').IntentCandidate[], sender: string) => string | undefined;
  authorizeExplicitHandler?: (sender: string, handler: string) => boolean;
  resolveHandlerHint?: (hint: import('@kehto/services').IntentHandlerHint, candidates: readonly import('@kehto/services').IntentCandidate[]) => string | undefined;
} = {}, getSimulation = () => normalizePajaSimulation({ relay: { mode: 'disabled' }, intent: { enabled: true } })) {
  const catalog = new InstalledNappletCatalog();
  const sequence: string[] = [];
  const controller = new BrowserIntentController({
    openOrReuse: () => {
      sequence.push('open target');
      return { id: 'generation-1' };
    },
    waitForReady: () => undefined,
    isCurrent: () => true,
    getWindowId: () => 'target-window',
    send: () => { sequence.push('deliver target'); },
  });
  const adapter = createPajaAdapter(
    { window: { id: 'paja', dTag: 'paja', aggregateHash: 'aggregate' } } as PajaHostConfig,
    getSimulation,
    () => {},
    () => {},
    () => true,
    undefined,
    undefined,
    undefined,
    { catalog, controller, resolveSender: () => `nip5d:35129:${'a'.repeat(64)}:social-feed`, ...policy },
  );
  return { adapter, catalog, sequence };
}

function runtimeContext(): ServiceRuntimeContext {
  return {
    resolveDTag: (windowId) => windowId === 'source' ? 'social-feed' : undefined,
    listWindowIds: () => [],
    hasCapability: () => true,
    sendToEligibleNapplet: () => true,
  };
}

async function sendIntent(
  adapter: ReturnType<typeof createPajaAdapter>,
  message: NappletMessage,
  onSend?: () => void,
): Promise<NappletMessage[]> {
  const service = adapter.services?.intent;
  if (!service) throw new Error('expected Paja intent service');
  service.onRegistered?.(runtimeContext());
  const sent: NappletMessage[] = [];
  service.handleMessage('source', message, (outbound) => {
    sent.push(outbound);
    onSend?.();
  });
  for (let turn = 0; turn < 24; turn += 1) await Promise.resolve();
  return sent;
}

describe('Paja browser adapter intent composition', () => {
  it('does not advertise an intent simulator when no real host controller is provided', () => {
    const adapter = createPajaAdapter(
      { window: { id: 'paja', dTag: 'paja', aggregateHash: 'aggregate' } } as PajaHostConfig,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' }, intent: { enabled: true } }),
      () => {},
      () => {},
      () => true,
    );

    expect(adapter.services?.intent).toBeUndefined();
    expect(adapter.intent?.isAvailable()).toBe(false);
    const domains = buildShellCapabilities(adapter).domains;
    expect(domains).not.toContain('keys');
    expect(domains).not.toContain('media');
    expect(domains).not.toContain('notify');
    expect(domains).not.toContain('intent');
    expect(domains).not.toContain('link');
    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });

  it('does not expose runtime fallback domains after enabling absent host services', () => {
    let simulation = normalizePajaSimulation({
      capabilities: { domains: { identity: false, theme: false } },
      relay: { mode: 'memory' },
    });
    const adapter = createPajaAdapter(
      { window: { id: 'paja', dTag: 'paja', aggregateHash: 'aggregate' } } as PajaHostConfig,
      () => simulation,
      () => {},
      () => {},
      () => true,
    );

    simulation = normalizePajaSimulation({ relay: { mode: 'live' } });

    expect(buildShellCapabilities(adapter).domains).not.toEqual(expect.arrayContaining([
      'relay',
      'identity',
      'theme',
    ]));
    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });

  it('uses closed verified installations for availability and handlers without a live frame', async () => {
    const { adapter, catalog } = makeAdapter();
    catalog.install(resolvedNapplet());

    const available = await sendIntent(adapter, {
      type: 'intent.available',
      id: 'available',
      archetype: 'profile',
    } as NappletMessage);
    const handlers = await sendIntent(adapter, { type: 'intent.handlers', id: 'handlers' } as NappletMessage);

    expect(available[0]).toMatchObject({
      type: 'intent.available.result',
      availability: { available: true, candidates: [{ id: CATALOG_ID }] },
    });
    expect(handlers[0]).toMatchObject({
      type: 'intent.handlers.result',
      handlers: [{ archetype: 'profile', available: true }],
    });
  });

  it('rechecks target intent availability without requiring INC for discovery or invocation', async () => {
    let intent = true;
    const { adapter, catalog, sequence } = makeAdapter({}, () => normalizePajaSimulation({
      relay: { mode: 'disabled' }, intent: { enabled: intent }, capabilities: { domains: { intent, inc: false } },
    }));
    const resolved = resolvedNapplet();
    catalog.install({ ...resolved, manifest: { ...resolved.manifest, requires: [], optional: ['inc'] } });
    intent = false;
    const availability = () => sendIntent(adapter, { type: 'intent.available', id: 'optional', archetype: 'profile' } as NappletMessage);

    await expect(availability()).resolves.toMatchObject([{ availability: { available: false, candidates: [] } }]);
    await expect(sendIntent(adapter, { type: 'intent.invoke', id: 'disabled', request: REQUEST } as NappletMessage))
      .resolves.toMatchObject([{ result: { ok: false } }]);
    expect(sequence).toEqual([]);
    intent = true;
    await expect(availability()).resolves.toMatchObject([{ availability: { available: true, candidates: [{ id: CATALOG_ID }] } }]);
    await expect(sendIntent(adapter, { type: 'intent.invoke', id: 'enabled', request: REQUEST } as NappletMessage))
      .resolves.toMatchObject([{ result: { ok: true, handler: CATALOG_ID } }]);
    intent = false;
    await expect(availability()).resolves.toMatchObject([{ availability: { available: false } }]);
    expect(catalog.get(CATALOG_ID)?.requires).toEqual([]);
    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });

  it('fails closed for ambiguity, stale defaults, cancelled or invalid chooser output, and unauthorized explicit handlers', async () => {
    const ambiguous = makeAdapter();
    ambiguous.catalog.install(resolvedNapplet('profile-a'));
    ambiguous.catalog.install(resolvedNapplet('profile-b'));
    await expect(sendIntent(ambiguous.adapter, { type: 'intent.invoke', id: 'ambiguous', request: REQUEST } as NappletMessage))
      .resolves.toMatchObject([{ result: { ok: false, error: 'invoke rejected' } }]);

    const staleDefault = makeAdapter({ getDefaultHandler: () => 'removed-profile' });
    staleDefault.catalog.install(resolvedNapplet());
    await expect(sendIntent(staleDefault.adapter, {
      type: 'intent.invoke', id: 'default', request: { ...REQUEST, handler: 'default' },
    } as NappletMessage)).resolves.toMatchObject([{ result: { ok: true, handler: CATALOG_ID } }]);

    const validDefault = makeAdapter({ getDefaultHandler: () => CATALOG_ID });
    validDefault.catalog.install(resolvedNapplet());
    await expect(sendIntent(validDefault.adapter, {
      type: 'intent.invoke', id: 'valid-default', request: { ...REQUEST, handler: 'default' },
    } as NappletMessage)).resolves.toMatchObject([{ result: { ok: true, handler: CATALOG_ID } }]);

    for (const chooseHandler of [
      () => undefined,
      () => 'not-installed',
    ]) {
      const chooser = makeAdapter({ chooseHandler });
      chooser.catalog.install(resolvedNapplet('profile-a'));
      chooser.catalog.install(resolvedNapplet('profile-b'));
      await expect(sendIntent(chooser.adapter, {
        type: 'intent.invoke', id: 'choose', request: { ...REQUEST, handler: 'choose' },
      } as NappletMessage)).resolves.toMatchObject([{
        result: { ok: false, error: chooseHandler() === undefined ? 'user cancelled' : 'invoke rejected' },
      }]);
    }

    const validChooser = makeAdapter({ chooseHandler: (_role, candidates) => candidates.find((candidate) => candidate.title === 'profile-b')?.id });
    validChooser.catalog.install(resolvedNapplet('profile-a'));
    validChooser.catalog.install(resolvedNapplet('profile-b'));
    await expect(sendIntent(validChooser.adapter, {
      type: 'intent.invoke', id: 'valid-choose', request: { ...REQUEST, handler: 'choose' },
    } as NappletMessage)).resolves.toMatchObject([{ result: { ok: true } }]);

    const denied = makeAdapter({ authorizeExplicitHandler: () => false });
    denied.catalog.install(resolvedNapplet());
    await expect(sendIntent(denied.adapter, {
      type: 'intent.invoke', id: 'denied', request: { ...REQUEST, handler: CATALOG_ID },
    } as NappletMessage)).resolves.toMatchObject([{ result: { ok: false, error: 'invoke rejected' } }]);
  });

  it('uses a permitted default before a recommendation resolver', async () => {
    const resolveHandlerHint = vi.fn(() => CATALOG_ID);
    const defaulted = makeAdapter({ getDefaultHandler: () => CATALOG_ID, resolveHandlerHint });
    defaulted.catalog.install(resolvedNapplet());
    await expect(sendIntent(defaulted.adapter, {
      type: 'intent.invoke', id: 'default-first', request: {
        ...REQUEST,
        handlerHint: { address: `35129:${'a'.repeat(64)}:profile-viewer` },
      },
    } as NappletMessage)).resolves.toMatchObject([{ result: { ok: true, handler: CATALOG_ID } }]);
    expect(resolveHandlerHint).not.toHaveBeenCalled();
  });

  it('returns only after an authorized exact installed handler has been dispatched', async () => {
    const { adapter, catalog, sequence } = makeAdapter({ authorizeExplicitHandler: () => true });
    catalog.install(resolvedNapplet());

    const accepted = await sendIntent(adapter, {
      type: 'intent.invoke', id: 'accepted', request: { ...REQUEST, handler: CATALOG_ID },
    } as NappletMessage, () => sequence.push('source accepted'));

    expect(accepted).toMatchObject([{ result: { ok: true, handler: CATALOG_ID } }]);
    expect(sequence).toEqual(['open target', 'source accepted', 'deliver target']);
  });

  it('removes the development simulator and composes the catalog resolver with the target controller', () => {
    const source = readFileSync(new URL('./browser-adapter.ts', import.meta.url), 'utf8');

    expect(source).toContain('createCatalogIntentResolver');
    expect(source).toContain('InstalledNappletCatalog');
    expect(source).toContain('BrowserIntentController');
    expect(source).not.toContain('DEV_INTENT');
    expect(source).not.toContain('No-op until Phase 105');
  });
});
