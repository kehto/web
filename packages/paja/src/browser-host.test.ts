import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createThemeService } from '@kehto/services';
import { originRegistry } from '@kehto/shell';

import { BrowserIntentController } from './browser-intent-controller.js';
import {
  createPajaIntentTargetOptions,
  markRuntimeTabReady,
  subscribePajaIntentCatalogChanges,
} from './browser-host.js';
import { matchesInstalledNappletRecord } from './installed-napplet-catalog.js';
import { InstalledNappletCatalog } from './installed-napplet-catalog.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';
import { createPajaThemeBroadcastLink } from './theme-broadcast.js';

import { PAJA_DEV_SIGNER_PUBKEY, createPajaAdapter } from './browser-adapter.js';
import { createPajaHostConfig, normalizePajaOptions } from './options.js';

describe('@kehto/paja browser host runtime source guards', () => {
  it('forwards one stored theme through one attached bridge without replay or replacement', () => {
    const link = createPajaThemeBroadcastLink();
    let service!: ReturnType<typeof createThemeService>;
    const forwarded: unknown[] = [];
    let callbackState: unknown;
    const darkTheme = {
      colors: { background: '#101211', text: '#f4f0df', primary: '#d8c36a' },
      title: 'Paja dark',
    };

    service = createThemeService({ onBroadcast: link.onBroadcast });
    expect(() => service.publishTheme(darkTheme)).toThrow('before a ShellBridge is attached');

    link.attach({
      publishTheme(theme) {
        callbackState = service.getCurrentTheme();
        forwarded.push(theme);
      },
    });
    expect(() => link.attach({ publishTheme() {} })).toThrow('already attached');

    service.publishTheme(darkTheme);

    expect(callbackState).toEqual(darkTheme);
    expect(forwarded).toEqual([darkTheme]);
  });

  it('uses the retained ThemeService as the only Paja theme fan-out path', () => {
    const adapterSource = readFileSync(new URL('./browser-adapter.ts', import.meta.url), 'utf8');
    const hostSource = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const setThemeMode = hostSource.slice(hostSource.indexOf('setThemeMode(mode) {'), hostSource.indexOf('setDomainEnabled(domain, enabled)'));

    expect(adapterSource).toContain('onBroadcast: onThemeBroadcast');
    expect(hostSource).toContain('const themeBroadcast = createPajaThemeBroadcastLink();');
    expect(hostSource).toContain('themeBroadcast.attach(bridge);');
    expect(setThemeMode.match(/themeService\?\.publishTheme/g)).toHaveLength(1);
    expect(setThemeMode).not.toContain('bridge.publishTheme');
    expect(setThemeMode).not.toContain('postMessage');
  });

  it('preserves resolved pointer identity before the runtime iframe executes', () => {
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const tabsSource = readFileSync(new URL('./browser-runtime-tabs.ts', import.meta.url), 'utf8');

    expect(source).toContain('if (isCurrentGeneration()) runtime.currentWindowId = windowId;');
    expect(tabsSource).toContain('`${config.window.id}:${tab.id}:${tab.generation}`');
    expect(tabsSource).toContain('if (state.activeTabId === tab.id) context.runtime.currentWindowId = windowId;');
  });

  it('injects the Class-1 CSP before the runtime-owned namespace only for verified pointers', () => {
    const source = readFileSync(new URL('./browser-target-frame.ts', import.meta.url), 'utf8');

    expect(source).toContain('injectNappletNamespacePrelude(');
    expect(source).toContain('const domains = environment.capabilities.domains;');
    expect(source).not.toContain('manifest.requires');
    expect(source).toContain("fetch(new URL('./__kehto/target.html', window.location.href)");
    expect(source).toContain('frame.removeAttribute(\'src\');');
    expect(source).toContain('frame.srcdoc = injectNappletNamespacePrelude(');
    expect(source).toContain(
      'injectNappletNamespacePrelude(\n      injectPajaRuntimeCsp(\n        resolvedTarget.indexHtml,',
    );
    expect(source).toContain("if (config.target.mode === 'runtime-pointer')");
    expect(source).toContain(
      'frame.srcdoc = injectNappletNamespacePrelude(\n    injectBaseHref(html, config.target.url),',
    );
    expect(source).not.toContain('bridge.runtime.sessionRegistry.register(');
  });

  it('registers both Paja target modes before their shared protected INC prelude executes', () => {
    const targetSource = readFileSync(new URL('./browser-target-frame.ts', import.meta.url), 'utf8');
    const preludeSource = readFileSync(new URL('../../shell/src/napplet-namespace.ts', import.meta.url), 'utf8');
    const registration = 'registerFrameForGeneration(frame, config, generation, identity, environment, windowId);';
    const injection = 'frame.srcdoc = injectNappletNamespacePrelude(';

    expect(targetSource.match(new RegExp(registration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(2);
    expect(targetSource.match(new RegExp(injection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(2);
    expect(targetSource.indexOf(registration)).toBeLessThan(targetSource.indexOf(injection));
    expect(targetSource.lastIndexOf(registration)).toBeLessThan(targetSource.lastIndexOf(injection));
    expect(targetSource).toContain('resolvedTarget.indexHtml');
    expect(targetSource).toContain('injectBaseHref(html, config.target.url)');

    expect(targetSource).not.toMatch(/decodeURIComponent\(|URLSearchParams|makeInc|inc\.channel\.(?:open|list|broadcast)/);
    expect(preludeSource).toContain('function makeProtectedInc(existing: unknown)');
    expect(preludeSource).toContain('return { ...extensions, ...inc };');
    expect(preludeSource).toContain('function guardNappletNamespace(namespace: Record<string, unknown>)');
  });

  it('only marks targets ready after the mandatory shell.ready handshake', () => {
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const devtoolsSource = readFileSync(new URL('./browser-devtools.ts', import.meta.url), 'utf8');
    const readyBranch = source.slice(
      source.indexOf("data.type === 'shell.ready'"),
      source.indexOf("frame?.addEventListener('load'"),
    );

    expect(readyBranch).toContain("data.type === 'shell.ready'");
    expect(readyBranch).not.toContain("typeof data.type === 'string'");
    expect(devtoolsSource).toContain('const realToProxy = new WeakMap<Window, Window>();');
    expect(devtoolsSource).toContain('originRegistry.getRegistrationId = (win: Window) =>');
    expect(devtoolsSource).toContain('originRegistry.getIdentity = (win: Window) =>');
  });

  it('keeps runtime pointers in closeable tabs with duplicate-load choices', () => {
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const tabsSource = readFileSync(new URL('./browser-runtime-tabs.ts', import.meta.url), 'utf8');

    expect(source).toContain('tabs: PajaRuntimeTab[];');
    expect(tabsSource).toContain('function renderRuntimeTabs(state: PajaRuntimeTabState): void');
    expect(tabsSource).toContain('function closeRuntimeTab(');
    expect(tabsSource).toContain('function showDuplicatePointerDialog()');
    expect(tabsSource).toContain("type PajaDuplicateChoice = 'load-again' | 'open-tab' | 'cancel';");
    expect(source).toContain('state.tabs.find((tab) => tab.key === resolvedTargetKey(resolvedTarget));');
  });

  it('keeps pointer runtime tabs shareable and restored from local storage', () => {
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const tabsSource = readFileSync(new URL('./browser-runtime-tabs.ts', import.meta.url), 'utf8');

    expect(tabsSource).toContain("export const PAJA_RUNTIME_TABS_STORAGE_KEY = 'kehto:paja:runtime-tabs:v1';");
    expect(tabsSource).toContain('function renderShareButton(tab: PajaRuntimeTab): HTMLButtonElement');
    expect(tabsSource).toContain('createPajaShareUrl(tab.pointerValue)');
    expect(source).toContain('function persistRuntimeTabs(state: PajaBrowserState): void');
    expect(source).toContain('function restorePersistedRuntimeTabs(');
    expect(source).toContain('const persistedTabs = readPersistedRuntimeTabs(config);');
    expect(source).toContain('else if (persistedTabs) void restorePersistedRuntimeTabs(state, context, persistedTabs);');
  });

  it('keeps external target asset resolution anchored to the authored target URL', () => {
    const source = readFileSync(new URL('./browser-target-frame.ts', import.meta.url), 'utf8');

    expect(source).toContain('function injectBaseHref(html: string, targetUrl: string): string');
    expect(source).toContain('`<base href="${escapeAttribute(targetUrl)}">`');
  });

  it('keeps Paja wired to real relay, outbox, and identity bootstrap paths', () => {
    const adapterSource = readFileSync(new URL('./browser-adapter.ts', import.meta.url), 'utf8');
    const intentSource = readFileSync(new URL('./browser-intent-host.ts', import.meta.url), 'utf8');
    const relaySource = readFileSync(new URL('./browser-relay-runtime.ts', import.meta.url), 'utf8');
    const hostSource = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');

    expect(adapterSource).toContain('createRelayPoolOutboxRouter');
    expect(adapterSource).toContain('() => relayConfig.getRelayUrls([\'discovery\', \'super\']),');
    expect(relaySource).toContain('createNip65Registry');
    expect(relaySource).toContain('export const PAJA_NIP65_RELAY_LIST_KIND = 10_002;');
    expect(relaySource).toContain('export const PAJA_CONTACT_LIST_KIND = 3;');
    expect(relaySource).toContain('export function createPajaIdentityProviders(');
    expect(relaySource).toContain('async function getBootstrapRelayUrls(');
    expect(relaySource).toContain('...await getSignerRelayUrls(signerProvider, \'read\'),');
    expect(relaySource).toContain('backend.query(await getBootstrapRelayUrls(getSimulation, signerProvider), [{');
    expect(intentSource).toContain('...getPajaRelayUrls(context.runtime.currentSimulation),');
    expect(hostSource).toContain('if (hasNip07Signer()) void state.connectNip07();');
    expect(hostSource).toContain("bridge.publishIdentityChanged(adapter.auth.getUserPubkey() ?? '');");
  });

  it('keeps the private social cache inside the established identity and outbox host boundary', () => {
    const adapterSource = readFileSync(new URL('./browser-adapter.ts', import.meta.url), 'utf8');
    const hostSource = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const diagnosticsSource = readFileSync(new URL('./browser-target-diagnostics.ts', import.meta.url), 'utf8');

    expect(adapterSource).toContain("import { createPajaSocialCache } from './browser-social-cache.js';");
    expect(adapterSource).toContain('const baseOutboxRouter = createOutboxRouter(backend, getSimulation, relayConfig, confirmRequest, signerProvider);');
    expect(adapterSource).toContain('baseRouter: baseOutboxRouter,');
    expect(adapterSource).toContain('getReadRouter: (windowId) => blossomEventResolver.decorate(baseOutboxRouter, windowId)');
    expect(adapterSource).toContain('getQueryRouter: (windowId, context) => blossomEventResolver.decorate(');
    expect(adapterSource).toContain('socialCache.decorate(');
    expect(adapterSource).toContain('uploadRuntime?.getServers()');
    expect(adapterSource).toContain("context?.hasCapability(windowId, 'identity:read') ?? false");
    expect(adapterSource).toContain('getFollows: socialCache.getFollows,');
    expect(adapterSource).toContain('getActivePubkey: () => getRuntimePubkey(getSimulation, signerProvider),');
    expect(adapterSource).toContain('getUserPubkey: () => getRuntimePubkey(getSimulation, signerProvider),');
    const runtimePubkey = adapterSource.slice(
      adapterSource.indexOf('function getRuntimePubkey('),
      adapterSource.indexOf('function createRuntimeSigner('),
    );
    expect(runtimePubkey.indexOf('signerProvider?.getPubkey()')).toBeLessThan(
      runtimePubkey.indexOf('getSimulation().identity.pubkey'),
    );
    expect(adapterSource).not.toContain('services.social');
    expect(adapterSource).not.toContain('paja.social');
    expect(diagnosticsSource).toContain('export async function reportTargetCorsDiagnostic(state: PajaBrowserState): Promise<void>');
    expect(hostSource).toContain("import { reportTargetCorsDiagnostic } from './browser-target-diagnostics.js';");
    expect(hostSource).toContain('startFrameNavigation(state, context);\n    void reportTargetCorsDiagnostic(state);');
  });

  it('uses the selected development signer identity and binds signing to the requesting napplet', async () => {
    const simulationPubkey = 'c'.repeat(64);
    const simulation = normalizePajaOptions({
      targetUrl: 'http://127.0.0.1:5173',
      simulation: { identity: { mode: 'fixed', pubkey: simulationPubkey } },
    }).simulation;
    const config = createPajaHostConfig(normalizePajaOptions({
      targetUrl: 'http://127.0.0.1:5173',
      simulation: { identity: { mode: 'fixed', pubkey: simulationPubkey } },
    }));
    const confirmRequest = vi.fn(() => true);
    const adapter = createPajaAdapter(
      config,
      () => simulation,
      () => {},
      () => {},
      confirmRequest,
      { getSigner: () => null, getMethod: () => 'dev', getPubkey: () => null },
      (windowId) => ({ dTag: `napplet-${windowId}`, aggregateHash: `hash-${windowId}` }),
    );

    expect(adapter.auth.getUserPubkey()).toBe(PAJA_DEV_SIGNER_PUBKEY);
    expect(adapter.auth.getSigner()?.getPublicKey()).toBe(PAJA_DEV_SIGNER_PUBKEY);
    await adapter.auth.getSigner('window-a')?.signEvent?.({
      kind: 1,
      created_at: 1,
      tags: [],
      content: 'hello',
    });
    expect(confirmRequest).toHaveBeenCalledWith(expect.objectContaining({
      action: 'sign',
      signerContext: {
        windowId: 'window-a',
        runtimeScope: 'target-url:http://127.0.0.1:5173/',
        napplet: { dTag: 'napplet-window-a', aggregateHash: 'hash-window-a' },
        signerPubkey: PAJA_DEV_SIGNER_PUBKEY,
      },
    }));
  });

  it('clears stale single-frame ownership before target reload readiness transitions', () => {
    const runtimeSource = readFileSync(new URL('./browser-host-runtime.ts', import.meta.url), 'utf8');
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const targetSource = readFileSync(new URL('./browser-target-frame.ts', import.meta.url), 'utf8');

    expect(runtimeSource).toContain('runtime.currentWindowId = null;');
    expect(source).toContain('unregisterSingleFrameWindow(bridge, runtime, windowId);');
    expect(source).toContain('const isCurrentGeneration = () => state.generation === generation;');
    expect(source).toContain('const registeredWindowId = source ? originRegistry.getWindowId(source) ?? null : null;');
    expect(source).toContain('if (isSingleFrameMessage && (!sourceWindowId || sourceWindowId !== runtime.currentWindowId)) return;');
    expect(targetSource).toContain('isCurrent?: () => boolean');
    expect(targetSource).toContain('if (isCurrent && !isCurrent()) return null;');
  });

  it('registers the trusted frame identity before resolver-built srcdoc can run', () => {
    const hostSource = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const targetSource = readFileSync(new URL('./browser-target-frame.ts', import.meta.url), 'utf8');
    const adapterSource = readFileSync(new URL('./browser-adapter.ts', import.meta.url), 'utf8');

    expect(targetSource).toContain('const identity = getTargetOriginIdentity(config, resolvedTarget);');
    expect(targetSource).toContain('resolvePajaFrameEnvironment(adapter, identity);');
    expect(targetSource).toContain('registerFrameForGeneration(frame, config, generation, identity, environment, windowId);');
    expect(targetSource).toContain('originRegistry.setEnvironment(win, environment);');
    expect(targetSource).toContain('onRegistered?.(registeredWindowId);');
    expect(hostSource).not.toContain("frame?.addEventListener('load'");
    expect(adapterSource).not.toContain('onNip5dIframeCreate:');
  });

  it('uses verified pointer records to retain and source-bind post-acceptance intent delivery', () => {
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const pointerLoad = source.slice(source.indexOf('async function loadRuntimePointer('), source.indexOf('async function restorePersistedRuntimeTabs('));
    const messageHandler = source.slice(source.indexOf("window.addEventListener('message'"), source.indexOf("frame?.addEventListener('error'"));

    expect(source).toContain("import { BrowserIntentController } from './browser-intent-controller.js';");
    expect(source).toContain("from './installed-napplet-catalog.js';");
    expect(pointerLoad).toContain('runtime.catalog.install(resolvedTarget);');
    expect(source).toContain('createPajaIntentTargetOptions');
    expect(messageHandler).toContain('markRuntimeTabReady');
    expect(messageHandler).toContain('originRegistry.getWindowId(source)');
  });

  it('does not reuse a same-dTag tab after its installed aggregate is replaced', () => {
    const installed = { dTag: 'profile-viewer', aggregateHash: 'verified-new' };
    const staleLiveTab = { dTag: 'profile-viewer', aggregateHash: 'verified-old' };
    const source = readFileSync(new URL('./browser-intent-host.ts', import.meta.url), 'utf8');

    expect(matchesInstalledNappletRecord(installed, staleLiveTab)).toBe(false);
    expect(source).toContain('closeRuntimeTab(state, context, stale.id)');
    expect(source).toContain('matchesInstalledNappletRecord(record, tab.resolvedTarget)');
  });

  it('uses the selected catalog record after cold resolution without reinstalling it', () => {
    const source = readFileSync(new URL('./browser-intent-host.ts', import.meta.url), 'utf8');
    const coldLoad = source.slice(source.indexOf('async openOrReuse(params)'), source.indexOf('waitForReady(generation)'));

    expect(coldLoad).toContain('context.runtime.catalog.validateCurrent(record, resolved)');
    expect(coldLoad).not.toContain('context.runtime.catalog.install(resolved)');
  });

  it('rejects unready stale records and delivers only to live B after catalog replacement', async () => {
    const priorDocument = globalThis.document;
    const priorHTMLElement = globalThis.HTMLElement;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: () => null } });
    Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: class {} });
    const catalog = new InstalledNappletCatalog();
    const resolved = (aggregateHash: string) => ({
      pointer: { type: 'naddr', value: `naddr-${aggregateHash}`, identifier: 'profile-viewer', pubkey: 'a'.repeat(64), kind: 35_129, relays: [] },
      event: { id: 'b'.repeat(64), pubkey: 'a'.repeat(64), created_at: 1, kind: 35_129, tags: [], content: '', sig: 'c'.repeat(128) },
      relays: [], blossomServers: [], dTag: 'profile-viewer', aggregateHash, indexHtml: '',
      manifest: { kind: 35_129, pubkey: 'a'.repeat(64), dTag: 'profile-viewer', aggregateHash, paths: [], servers: [], requires: ['inc'], archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }] },
    }) as PajaResolvedPointer;
    const makeTab = (id: string, target: PajaResolvedPointer) => {
      const source = { postMessage: vi.fn() } as unknown as Window;
      const tab = { id, generation: 1, resolvedTarget: target, frame: { contentWindow: source, remove: vi.fn() }, windowId: id, status: 'booting' };
      originRegistry.register(source, id, { dTag: target.dTag, aggregateHash: target.aggregateHash });
      return { tab, source };
    };
    const targetA = resolved('aggregate-a');
    const targetB = resolved('aggregate-b');
    const tabA = makeTab('tab-a', targetA);
    const state = { tabs: [tabA.tab], activeTabId: 'tab-b', messageLog: [] } as unknown as import('./browser-host.js').PajaBrowserState;
    const runtime = { catalog, readyWindowIds: new Set<string>(), readyWaiters: new Map(), intentRecords: new WeakMap(), currentWindowId: null };
    const context = { runtime, bridge: { runtime: { destroyWindow: vi.fn(), sessionRegistry: { unregister: vi.fn() } } }, onTabDestroyed: vi.fn(), setStatus: vi.fn(), setPointerStatus: vi.fn() } as unknown as import('./browser-host.js').PajaBrowserStateContext;
    const stopCatalogChanges = subscribePajaIntentCatalogChanges(state, context);
    try {
      catalog.install(targetA);
      const controller = new BrowserIntentController({ ...createPajaIntentTargetOptions(() => state, () => context), maxAttempts: 3 });
      const task = controller.dispatch({ handler: 'profile-viewer', sender: 'feed', archetype: 'profile', action: 'open', convention: 'napplet:profile/open', payload: {} });
      await Promise.resolve();
      // Installing an equal record still replaces the object version token and
      // must reject A's outstanding readiness wait.
      catalog.install(targetA);
      for (let turn = 0; turn < 4; turn += 1) await Promise.resolve();
      const tabB = makeTab('tab-b', targetB);
      state.tabs.push(tabB.tab as never);
      catalog.install(targetB);
      for (let turn = 0; turn < 4; turn += 1) await Promise.resolve();
      markRuntimeTabReady(state, context, tabB.tab as never, tabB.source, 'tab-b');
      await task;
      expect((tabA.source as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage).not.toHaveBeenCalled();
      expect((tabB.source as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage).toHaveBeenCalledTimes(1);
      expect((tabB.source as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'inc.event', topic: 'napplet:profile/open', sender: 'feed' }), '*', undefined);
      expect(catalog.get('profile-viewer')).toMatchObject({ aggregateHash: 'aggregate-b' });
    } finally {
      stopCatalogChanges();
      originRegistry.clear();
      Object.defineProperty(globalThis, 'document', { configurable: true, value: priorDocument });
      Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: priorHTMLElement });
    }
  });
});
