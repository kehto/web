import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';
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
      archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }],
    },
  };
}

function makeAdapter(policy: {
  getDefaultHandler?: (archetype: string) => string | undefined;
  chooseHandler?: (archetype: string, candidates: readonly { dTag: string }[], sender: string) => string | undefined;
  authorizeExplicitHandler?: (sender: string, handler: string) => boolean;
} = {}) {
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
    () => normalizePajaSimulation({ relay: { mode: 'disabled' }, intent: { enabled: true } }),
    () => {},
    () => {},
    () => true,
    undefined,
    undefined,
    undefined,
    { catalog, controller, ...policy },
  );
  return { adapter, catalog, sequence };
}

function runtimeContext(): ServiceRuntimeContext {
  return {
    resolveDTag: (windowId) => windowId === 'source' ? 'social-feed' : undefined,
    listWindowIds: () => [],
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
      availability: { available: true, candidates: [{ dTag: 'profile-viewer' }] },
    });
    expect(handlers[0]).toMatchObject({
      type: 'intent.handlers.result',
      handlers: [{ archetype: 'profile', available: true }],
    });
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
    } as NappletMessage)).resolves.toMatchObject([{ result: { ok: false, error: 'invoke rejected' } }]);

    const validDefault = makeAdapter({ getDefaultHandler: () => 'profile-viewer' });
    validDefault.catalog.install(resolvedNapplet());
    await expect(sendIntent(validDefault.adapter, {
      type: 'intent.invoke', id: 'valid-default', request: { ...REQUEST, handler: 'default' },
    } as NappletMessage)).resolves.toMatchObject([{ result: { ok: true, handler: 'profile-viewer' } }]);

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

    const validChooser = makeAdapter({ chooseHandler: () => 'profile-b' });
    validChooser.catalog.install(resolvedNapplet('profile-a'));
    validChooser.catalog.install(resolvedNapplet('profile-b'));
    await expect(sendIntent(validChooser.adapter, {
      type: 'intent.invoke', id: 'valid-choose', request: { ...REQUEST, handler: 'choose' },
    } as NappletMessage)).resolves.toMatchObject([{ result: { ok: true, handler: 'profile-b' } }]);

    const denied = makeAdapter({ authorizeExplicitHandler: () => false });
    denied.catalog.install(resolvedNapplet());
    await expect(sendIntent(denied.adapter, {
      type: 'intent.invoke', id: 'denied', request: { ...REQUEST, handler: 'profile-viewer' },
    } as NappletMessage)).resolves.toMatchObject([{ result: { ok: false, error: 'invoke rejected' } }]);
  });

  it('returns only after an authorized exact installed handler has been dispatched', async () => {
    const { adapter, catalog, sequence } = makeAdapter({ authorizeExplicitHandler: () => true });
    catalog.install(resolvedNapplet());

    const accepted = await sendIntent(adapter, {
      type: 'intent.invoke', id: 'accepted', request: { ...REQUEST, handler: 'profile-viewer' },
    } as NappletMessage, () => sequence.push('source accepted'));

    expect(accepted).toMatchObject([{ result: { ok: true, handler: 'profile-viewer' } }]);
    expect(sequence).toEqual(['open target', 'deliver target', 'source accepted']);
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
