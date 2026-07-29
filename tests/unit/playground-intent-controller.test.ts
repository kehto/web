import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { IntentDispatchParams } from '@kehto/services';
import { createCatalogIntentResolver } from '@kehto/services';
import { PlaygroundIntentController } from '../../apps/playground/src/playground-intent-controller.js';
import {
  InstalledNappletCatalog,
  matchesInstalledNappletRecord,
} from '../../apps/playground/src/installed-napplet-catalog.js';

function params(overrides: Partial<IntentDispatchParams> = {}): IntentDispatchParams {
  return {
    handler: 'profile-viewer',
    sender: 'social-feed',
    archetype: 'profile',
    action: 'open',
    convention: 'napplet:profile/open',
    payload: { pubkey: 'a'.repeat(64) },
    ...overrides,
  };
}

function installProfile(
  catalog: InstalledNappletCatalog,
  dTag = 'profile-viewer',
  aggregateHash = `${dTag}-aggregate`,
) {
  return catalog.install({
    dTag,
    aggregateHash,
    requires: ['inc'],
    archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }],
    indexHtml: '<main>verified</main>',
  }, { name: dTag, containerId: `${dTag}-frame` });
}

describe('PlaygroundIntentController', () => {
  it('waits for a current ready target, delivers once, and returns its window id', async () => {
    let releaseReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      releaseReady = resolve;
    });
    const send = vi.fn();
    const controller = new PlaygroundIntentController({
      openOrReuse: () => ({ id: 'profile-generation-1' }),
      waitForReady: () => ready,
      isCurrent: () => true,
      getWindowId: () => 'profile-window',
      send,
    });
    const dispatched = controller.dispatch(params());
    releaseReady();
    await expect(dispatched).resolves.toEqual({ windowId: 'profile-window' });
    expect(send).toHaveBeenCalledOnce();
  });

  it('retries replacement and rejects bounded terminal failures', async () => {
    const send = vi.fn();
    const replaced = new PlaygroundIntentController({
      openOrReuse: vi.fn()
        .mockResolvedValueOnce({ id: 'replaced' })
        .mockResolvedValueOnce({ id: 'current' }),
      waitForReady: vi.fn(),
      isCurrent: (generation) => generation.id === 'current',
      getWindowId: () => 'current-window',
      send,
      maxAttempts: 2,
    });
    await expect(replaced.dispatch(params())).resolves.toEqual({ windowId: 'current-window' });
    expect(send).toHaveBeenCalledTimes(1);

    const onTerminal = vi.fn();
    const failed = new PlaygroundIntentController({
      openOrReuse: () => null,
      waitForReady: vi.fn(),
      isCurrent: () => false,
      getWindowId: () => null,
      send: vi.fn(),
      maxAttempts: 2,
      onTerminal,
    });
    await expect(failed.dispatch(params())).rejects.toThrow('open-failed');
    expect(onTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ handler: 'profile-viewer' }),
      'open-failed',
    );
  });

  it('fails closed for defaults, chooser output, and explicit targets', async () => {
    const controller = new PlaygroundIntentController({
      openOrReuse: () => ({ id: 'current' }),
      waitForReady: () => undefined,
      isCurrent: () => true,
      getWindowId: () => 'current-window',
      send: () => undefined,
    });
    const invoke = (
      chooseHandler: () => string | undefined,
      handler: string,
    ) => {
      const catalog = new InstalledNappletCatalog();
      installProfile(catalog, 'profile-a');
      installProfile(catalog, 'profile-b');
      catalog.setDefaultHandler('profile', 'removed-profile');
      return createCatalogIntentResolver({
        loadCatalog: () => catalog.intentCatalog(),
        targets: controller,
        getDefaultHandler: (archetype) => catalog.getDefaultHandler(archetype),
        chooseHandler,
        authorizeExplicitHandler: () => false,
      }).invoke({
        archetype: 'profile',
        convention: 'napplet:profile/open',
        handler,
      }, { sender: 'social-feed' });
    };

    await expect(invoke(() => undefined, 'default')).resolves.toMatchObject({
      ok: false,
      error: 'invoke rejected',
    });
    await expect(invoke(() => undefined, 'choose')).resolves.toMatchObject({
      ok: false,
      error: 'user cancelled',
    });
    await expect(invoke(() => 'not-installed', 'choose')).resolves.toMatchObject({
      ok: false,
      error: 'invoke rejected',
    });
    await expect(invoke(() => 'profile-a', 'profile-a')).resolves.toMatchObject({
      ok: false,
      error: 'invoke rejected',
    });
  });

  it('composes verified catalog selection with canonical INC convention delivery', () => {
    const main = readFileSync(new URL('../../apps/playground/src/main.ts', import.meta.url), 'utf8');
    const shellHost = readFileSync(new URL('../../apps/playground/src/shell-host.ts', import.meta.url), 'utf8');
    expect(main).toContain('createCatalogIntentResolver');
    expect(main).toContain('createIntentService');
    expect(main).toContain('createPlaygroundIntentTargetOptions');
    expect(shellHost).toContain('markIntentTargetReady(windowId, sourceWindow)');
    expect(shellHost).toContain("type: 'inc.event'");
    expect(shellHost).not.toContain("type: 'intent.deliver'");
  });

  it('does not reuse a same-dTag frame after its verified aggregate is replaced', () => {
    expect(matchesInstalledNappletRecord(
      { dTag: 'profile-viewer', aggregateHash: 'new' },
      { dTag: 'profile-viewer', aggregateHash: 'old' },
    )).toBe(false);
    const shellHost = readFileSync(new URL('../../apps/playground/src/shell-host.ts', import.meta.url), 'utf8');
    expect(shellHost).toContain('closeNapplet(stale.windowId)');
    expect(shellHost).toContain('shouldReuseIntentTarget(params)');
  });

});
