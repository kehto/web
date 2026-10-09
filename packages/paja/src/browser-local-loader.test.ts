import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { originRegistry } from '@kehto/shell';

import { createPajaAdapter } from './browser-adapter.js';
import { loadLocalRuntimeFile, pickLocalHtmlFile } from './browser-local-loader.js';
import {
  snapshotRuntimeTabs,
  type PajaRuntimeTabContext,
  type PajaRuntimeTabState,
} from './browser-runtime-tabs.js';
import { navigateFrame } from './browser-target-frame.js';
import { InstalledNappletCatalog } from './installed-napplet-catalog.js';
import { createPajaLocalTarget } from './local-target.js';
import { createPajaRuntimeHostConfig } from './options.js';

const LOCAL_HTML = '<!doctype html><html><head><title>Local</title></head><body><script>window.ok = 1</script></body></html>';

interface FakeFrame {
  id: string;
  className: string;
  title: string;
  hidden: boolean;
  srcdoc: string;
  dataset: Record<string, string>;
  contentWindow: Window;
  sandbox: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  addEventListener: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

function fakeFrame(): FakeFrame {
  return {
    id: '',
    className: '',
    title: '',
    hidden: false,
    srcdoc: '',
    dataset: {},
    contentWindow: { postMessage: vi.fn() } as unknown as Window,
    sandbox: { add: vi.fn(), remove: vi.fn() },
    addEventListener: vi.fn(),
    removeAttribute: vi.fn(),
    remove: vi.fn(),
  };
}

function createHarness() {
  const config = createPajaRuntimeHostConfig({}, new Date('2026-10-07T00:00:00.000Z'));
  const catalog = new InstalledNappletCatalog();
  const install = vi.spyOn(catalog, 'install');
  const state = {
    config,
    pointerValue: '',
    pointerStatus: 'idle',
    tabs: [],
    activeTabId: null,
    generation: 0,
    status: 'ready',
    resolvedTarget: null,
    messageFilter: '',
    messageLog: [],
    activateTab: vi.fn(),
    closeTab: vi.fn(),
  } as unknown as PajaRuntimeTabState;
  const navigate = vi.fn(async () => 'window-id');
  const setWindowBlossomServers = vi.fn();
  const context = {
    config,
    stage: { append: vi.fn() },
    bridge: null,
    adapter: { setWindowBlossomServers },
    runtime: { catalog, currentSimulation: config.simulation, currentWindowId: null, readyWindowIds: new Set() },
    navigateFrame: navigate,
    renderTargetErrorHtml: (error: unknown) => String(error),
    setPointerStatus: vi.fn((current: PajaRuntimeTabState, message: string) => {
      current.pointerStatus = message;
    }),
    setStatus: vi.fn((current: PajaRuntimeTabState, status: PajaRuntimeTabState['status']) => {
      current.status = status;
    }),
  } as unknown as PajaRuntimeTabContext;
  return { state, context, catalog, install, navigate, setWindowBlossomServers };
}

describe('@kehto/paja local index.html loader', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => fakeFrame(),
      getElementById: () => null,
      querySelector: () => null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('HTMLElement', class {});
    vi.stubGlobal('HTMLInputElement', class {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    originRegistry.clear();
  });

  it('opens a local file in an unpersisted tab without touching the verified catalog', async () => {
    const { state, context, catalog, install, navigate, setWindowBlossomServers } = createHarness();
    const persistTabs = vi.fn();

    await loadLocalRuntimeFile(state, context, { name: 'index.html', text: LOCAL_HTML }, { persistTabs });

    expect(state.tabs).toHaveLength(1);
    const [tab] = state.tabs;
    expect(tab).toMatchObject({ title: 'index.html', pointerValue: '' });
    expect(tab?.pointerStatus).toBe(`local local-index:${tab?.resolvedTarget.aggregateHash.slice(0, 12)}`);
    expect(state.pointerStatus).toBe(tab?.pointerStatus);
    expect(tab?.key).toBe(`local:local-index:${tab?.resolvedTarget.aggregateHash}`);
    expect(tab?.resolvedTarget).toMatchObject({ source: 'local', indexHtml: LOCAL_HTML });
    expect(navigate).toHaveBeenCalledWith(
      tab?.frame,
      context.config,
      1,
      context.adapter,
      tab?.resolvedTarget,
      expect.stringContaining(':tab-1:1'),
      expect.any(Function),
      expect.any(Function),
    );
    expect(install).not.toHaveBeenCalled();
    expect(catalog.installed()).toEqual([]);
    expect(setWindowBlossomServers).not.toHaveBeenCalled();
    expect(persistTabs).toHaveBeenCalledWith(state);
    expect(snapshotRuntimeTabs(state)).toBeNull();
    expect(state.messageLog.map((entry) => entry.type)).toEqual(['paja.local.load', 'paja.local.loaded']);
  });

  it('reports rejected files in the status line and message log without adding a tab', async () => {
    const { state, context } = createHarness();

    await loadLocalRuntimeFile(state, context, { name: 'main.js', text: 'alert(1)' }, { persistTabs: vi.fn() });

    expect(state.tabs).toEqual([]);
    expect(state.pointerStatus).toContain('"main.js" is not an HTML file.');
    expect(state.pointerStatus).toContain('single-file index.html only');
    expect(state.messageLog.at(-1)?.type).toBe('paja.local.error');
    expect(state.messageLog.at(-1)?.preview).toContain('main.js');
  });

  it('warns about relative assets that cannot load from srcdoc', async () => {
    const { state, context } = createHarness();

    await loadLocalRuntimeFile(
      state,
      context,
      { name: 'index.html', text: '<script type="module" src="./assets/main.js"></script>' },
      { persistTabs: vi.fn() },
    );

    expect(state.tabs).toHaveLength(1);
    expect(state.pointerStatus).toContain('1 relative asset(s) will not load');
    expect(state.messageLog.at(-1)?.type).toBe('paja.local.loaded');
    expect(state.messageLog.at(-1)?.preview).toContain('./assets/main.js');
  });

  it.each([
    ['plain HTML', LOCAL_HTML],
    ['untrusted publisher metadata', LOCAL_HTML.replace('<head>', '<head><meta name="napplet-requires" content="unavailable">')],
  ])('loads local %s without a manifest and registers identity before injected srcdoc', async (_label, html) => {
    const config = createPajaRuntimeHostConfig({}, new Date('2026-10-07T00:00:00.000Z'));
    const adapter = createPajaAdapter(config, () => config.simulation, () => {}, () => {}, () => true);
    const target = await createPajaLocalTarget({ name: 'index.html', text: html });
    const frame = fakeFrame();
    let srcdoc = '';
    Object.defineProperty(frame, 'srcdoc', {
      get: () => srcdoc,
      set(value: string) {
        expect(originRegistry.getIdentity(frame.contentWindow)).toEqual({
          dTag: target.dTag, aggregateHash: target.aggregateHash,
        });
        expect(originRegistry.getEnvironment(frame.contentWindow)?.capabilities.domains).not.toContain('unavailable');
        srcdoc = value;
      },
    });

    try {
      const windowId = await navigateFrame(
        frame as unknown as HTMLIFrameElement,
        config,
        1,
        adapter,
        target,
        'paja-window:tab-1:1',
      );

      expect(windowId).toBe('paja-window:tab-1:1');
      expect(originRegistry.getIdentity(frame.contentWindow)).toEqual({
        dTag: 'local-index',
        aggregateHash: target.aggregateHash,
      });
      expect(frame.removeAttribute).toHaveBeenCalledWith('src');
      expect(frame.srcdoc).toContain('http-equiv="Content-Security-Policy"');
      expect(frame.srcdoc).toContain("connect-src 'none'");
      // The runtime-owned prelude defines window.napplet (with mandatory shell)
      // and runs before the file's own scripts.
      expect(frame.srcdoc).toContain('Object.defineProperty(target, "napplet"');
      expect(frame.srcdoc).toContain('(["shell",');
      expect(frame.srcdoc.indexOf('Content-Security-Policy')).toBeLessThan(frame.srcdoc.indexOf('<script>window.ok = 1</script>'));
      expect(frame.srcdoc.indexOf('(["shell",')).toBeLessThan(frame.srcdoc.indexOf('<script>window.ok = 1</script>'));
      expect(frame.srcdoc).toContain('<script>window.ok = 1</script>');
    } finally {
      (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
    }
  });

  it('prefers the first HTML file from a multi-file drop', () => {
    const files = [{ name: 'notes.txt', type: 'text/plain' }, { name: 'index.html', type: '' }];

    expect(pickLocalHtmlFile(files)).toBe(files[1]);
    expect(pickLocalHtmlFile([{ name: 'notes.txt' }])).toEqual({ name: 'notes.txt' });
    expect(pickLocalHtmlFile([])).toBeNull();
  });

  it('keeps local loading out of the installed catalog and wired only in runtime-pointer mode', () => {
    const loader = readFileSync(new URL('./browser-local-loader.ts', import.meta.url), 'utf8');
    const host = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');
    const intentHost = readFileSync(new URL('./browser-intent-host.ts', import.meta.url), 'utf8');

    expect(loader).not.toContain('catalog.install');
    expect(loader).not.toContain('runtime.catalog');
    expect(loader).toContain("addRuntimeTab(state, context, '', target);");
    expect(host).toContain('async loadLocalFile(file) {');
    // Intent delivery stays on verified catalog tabs: local tabs are neither
    // closed as stale catalog tabs nor reused as delivery targets.
    expect(intentHost).toContain('!isPajaLocalTarget(stale.resolvedTarget)');
    expect(intentHost).toContain('!isPajaLocalTarget(tab.resolvedTarget)\n        && matchesInstalledNappletRecord(record, tab.resolvedTarget)');
    expect(host).toContain(
      "if (state.config.target.mode === 'runtime-pointer') {\n    installLocalFileControls((file) => state.loadLocalFile(file));",
    );
  });
});
