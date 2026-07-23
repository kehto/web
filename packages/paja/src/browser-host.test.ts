import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('@kehto/paja browser host runtime source guards', () => {
  it('preserves resolved pointer identity before the runtime iframe executes', () => {
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const tabsSource = readFileSync(new URL('./browser-runtime-tabs.ts', import.meta.url), 'utf8');

    expect(source).toContain('if (isCurrentGeneration()) runtime.currentWindowId = windowId;');
    expect(tabsSource).toContain('`${config.window.id}:${tab.id}:${tab.generation}`');
    expect(tabsSource).toContain('if (state.activeTabId === tab.id) context.runtime.currentWindowId = windowId;');
  });

  it('injects the runtime-owned napplet namespace in pointer and URL target srcdoc paths', () => {
    const source = readFileSync(new URL('./browser-target-frame.ts', import.meta.url), 'utf8');

    expect(source).toContain('injectNappletNamespacePrelude(');
    expect(source).toContain('const domains = environment.capabilities.domains;');
    expect(source).not.toContain('manifest.requires');
    expect(source).toContain("fetch(new URL('./__kehto/target.html', window.location.href)");
    expect(source).toContain('frame.removeAttribute(\'src\');');
    expect(source).toContain('frame.srcdoc = injectNappletNamespacePrelude(');
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
    const relaySource = readFileSync(new URL('./browser-relay-runtime.ts', import.meta.url), 'utf8');
    const hostSource = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');

    expect(adapterSource).toContain('createRelayPoolOutboxRouter');
    expect(adapterSource).toContain('createPajaRelayListLoader(backend, getSimulation, signerProvider)');
    expect(relaySource).toContain('createNip65Registry');
    expect(relaySource).toContain('export const PAJA_NIP65_RELAY_LIST_KIND = 10_002;');
    expect(relaySource).toContain('export const PAJA_CONTACT_LIST_KIND = 3;');
    expect(relaySource).toContain('export function createPajaIdentityProviders(');
    expect(relaySource).toContain('async function getBootstrapRelayUrls(');
    expect(relaySource).toContain('...await getSignerRelayUrls(signerProvider, \'read\'),');
    expect(relaySource).toContain('backend.query(await getBootstrapRelayUrls(getSimulation, signerProvider), [{');
    expect(hostSource).toContain('...getPajaRelayUrls(runtime.currentSimulation),');
    expect(hostSource).toContain('if (hasNip07Signer()) void state.connectNip07();');
  });

  it('clears stale single-frame ownership before target reload readiness transitions', () => {
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const targetSource = readFileSync(new URL('./browser-target-frame.ts', import.meta.url), 'utf8');

    expect(source).toContain('runtime.currentWindowId = null;');
    expect(source).toContain('unregisterSingleFrameWindow(bridge, runtime, windowId);');
    expect(source).toContain('const isCurrentGeneration = () => state.generation === generation;');
    expect(source).toContain('const registeredWindowId = source ? originRegistry.getWindowId(source) : null;');
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
});
