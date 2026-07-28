import { describe, expect, it, vi } from 'vitest';
import type { IntentDispatchParams } from '@kehto/services';
import type { PajaResolvedPointer } from './runtime-resolver.js';
import { BrowserIntentController } from './browser-intent-controller.js';
import { InstalledNappletCatalog } from './installed-napplet-catalog.js';

function resolvedNapplet(overrides: Partial<PajaResolvedPointer> = {}): PajaResolvedPointer {
  return {
    pointer: {
      type: 'naddr',
      value: 'naddr1verified',
      identifier: 'profile-viewer',
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
    blossomServers: ['https://blossom.example'],
    dTag: 'profile-viewer',
    aggregateHash: 'd'.repeat(64),
    indexHtml: '<main>verified</main>',
    manifest: {
      kind: 35_129,
      pubkey: 'a'.repeat(64),
      dTag: 'profile-viewer',
      aggregateHash: 'd'.repeat(64),
      paths: [],
      servers: [],
      requires: ['inc'],
      title: 'Profile Viewer',
      archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }],
    },
    ...overrides,
  };
}

describe('InstalledNappletCatalog', () => {
  it('stores copied serializable verified-manifest and pointer facts without browser identities', () => {
    const catalog = new InstalledNappletCatalog();
    const resolved = resolvedNapplet();

    catalog.install(resolved);
    const [installed] = catalog.installed();

    expect(installed).toMatchObject({
      dTag: 'profile-viewer',
      aggregateHash: 'd'.repeat(64),
      title: 'Profile Viewer',
      pointer: { value: 'naddr1verified' },
      archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }],
    });
    expect(JSON.parse(JSON.stringify(installed))).toEqual(installed);
    expect(JSON.stringify(installed)).not.toContain('indexHtml');
    expect(JSON.stringify(installed)).not.toContain('windowId');
  });

  it('keeps verified installations after target close and removes only explicit artifacts', () => {
    const catalog = new InstalledNappletCatalog();
    catalog.install(resolvedNapplet());

    expect(catalog.has('profile-viewer')).toBe(true);
    expect(catalog.remove('missing')).toBe(false);
    expect(catalog.remove('profile-viewer')).toBe(true);
    expect(catalog.has('profile-viewer')).toBe(false);
  });

  it('derives exact intent contracts from the verified manifest rather than live targets', () => {
    const catalog = new InstalledNappletCatalog();
    catalog.install(resolvedNapplet({
      manifest: {
        ...resolvedNapplet().manifest,
        archetypes: [
          { slug: 'profile', convention: 'napplet:profile/open' },
          { slug: 'profile', convention: 'napplet:profile/edit' },
        ],
      },
    }));

    expect(catalog.intentCatalog()).toEqual([{
      dTag: 'profile-viewer',
      title: 'Profile Viewer',
      archetypes: {
        profile: {
          actions: ['open', 'edit'],
          conventions: ['napplet:profile/open', 'napplet:profile/edit'],
        },
      },
    }]);
  });

  it('abandons a held cold resolution after its selected installed record is replaced', async () => {
    const catalog = new InstalledNappletCatalog();
    const aggregateA = 'a'.repeat(64);
    const aggregateB = 'e'.repeat(64);
    const resolvedA = resolvedNapplet({
      aggregateHash: aggregateA,
      manifest: { ...resolvedNapplet().manifest, aggregateHash: aggregateA },
    });
    const resolvedB = resolvedNapplet({
      aggregateHash: aggregateB,
      manifest: { ...resolvedNapplet().manifest, aggregateHash: aggregateB },
    });
    const selected = catalog.install(resolvedA);
    let releaseResolution!: (resolved: PajaResolvedPointer) => void;
    const resolution = new Promise<PajaResolvedPointer>((resolve) => {
      releaseResolution = resolve;
    });
    const send = vi.fn();
    const onTerminal = vi.fn();
    let attempts = 0;
    const controller = new BrowserIntentController({
      openOrReuse: async () => {
        attempts += 1;
        if (attempts !== 1) return null;
        const resolved = await resolution;
        return catalog.validateCurrent(selected, resolved) ? { id: 'aggregate-a' } : null;
      },
      waitForReady: () => undefined,
      isCurrent: () => true,
      getWindowId: () => 'profile-window',
      send,
      maxAttempts: 2,
      onTerminal,
    });
    const delivery: IntentDispatchParams = {
      handler: 'profile-viewer',
      sender: 'social-feed',
      archetype: 'profile',
      action: 'open',
      convention: 'napplet:profile/open',
      payload: { pubkey: 'a'.repeat(64) },
    };

    const deliveryTask = controller.dispatch(delivery);
    await Promise.resolve();
    catalog.install(resolvedB);
    releaseResolution(resolvedA);
    await expect(deliveryTask).rejects.toThrow('open-failed');

    expect(catalog.get('profile-viewer')).toMatchObject({ aggregateHash: aggregateB });
    expect(send).not.toHaveBeenCalled();
    expect(attempts).toBe(2);
    expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ handler: 'profile-viewer' }), 'open-failed');
  });
});
