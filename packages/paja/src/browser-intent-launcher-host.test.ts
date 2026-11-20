import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PajaBrowserState, PajaBrowserStateContext } from './browser-host.js';
import type { PajaIntentLinkProgress } from './browser-intent-links.js';
import type { ParsedPajaIntentLink } from './intent-link.js';

/** Captured before any test stubs the global, so stubs can delegate real entropy. */
const nativeCrypto = globalThis.crypto;

const posted: { correlation: string }[] = [];
vi.mock('./browser-intent-link-target.js', () => ({ resolvePajaSharedLinkHandler: async () => undefined }));
vi.mock('./intent-launcher.js', () => ({
  resolvePajaIntentLauncher: async () => ({ manifest: { catalogId: 'launcher-catalog' } }),
  postPajaIntentLauncherMessage: (_frame: unknown, message: { correlation: string }) => { posted.push(message); },
}));
const { launchPajaSharedIntent } = await import('./browser-intent-launcher-host.js');

const UUID_V4 = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

type LauncherEntry = { windowId: string; ready(): void; result(correlation: string, value: unknown): void };

function harness() {
  const source = {} as Window;
  const frame = { hidden: false, contentWindow: source, sandbox: { add: vi.fn() }, remove: vi.fn(),
    getAttribute: () => null, setAttribute: vi.fn() };
  vi.stubGlobal('document', { createElement: () => frame });
  vi.stubGlobal('window', { setTimeout: (run: () => void, ms: number) => setTimeout(run, ms), clearTimeout: (id: number) => clearTimeout(id) });
  const launcherFrames = new Map<Window, LauncherEntry>();
  const windowIds: string[] = [];
  const context = {
    runtime: { intentSenderIds: new Map<string, string>(), explicitIntentHandlers: new Map<string, string>(), launcherFrames },
    stage: { append: vi.fn() }, config: { window: { id: 'paja' } }, adapter: {},
    bridge: { observeFrame: vi.fn(), runtime: { destroyWindow: vi.fn(), sessionRegistry: { unregister: vi.fn() } } },
    navigateFrame: vi.fn(async (...args: unknown[]) => {
      const windowId = (args[6] as { windowId: string }).windowId;
      windowIds.push(windowId);
      // The launcher napplet reports ready, then answers the correlated launch.
      queueMicrotask(() => {
        launcherFrames.get(source)!.ready();
        queueMicrotask(() => queueMicrotask(() => launcherFrames.get(source)?.result(posted.at(-1)!.correlation, { ok: true })));
      });
      return windowId;
    }),
  } as unknown as PajaBrowserStateContext;
  const progress = { isActive: () => true, accepted: vi.fn() } as unknown as PajaIntentLinkProgress & { accepted: ReturnType<typeof vi.fn> };
  const intent = { uri: 'napplet:note/open', request: {} } as unknown as ParsedPajaIntentLink;
  return { context, progress, intent, windowIds, state: { generation: 1 } as PajaBrowserState };
}

afterEach(() => { posted.length = 0; vi.unstubAllGlobals(); });

describe('Paja shared-intent launcher ids (kehto/web#351)', () => {
  it('mints the launcher window id and launch correlation from getRandomValues when crypto.randomUUID is missing', async () => {
    // Non-localhost HTTP: getRandomValues exists, randomUUID and subtle do not.
    const provider = {
      getRandomValues: vi.fn(function (this: unknown, bytes: Uint8Array) {
        if (this !== provider) throw new TypeError('Illegal invocation');
        return nativeCrypto.getRandomValues(bytes);
      }),
    };
    const h = harness();
    vi.stubGlobal('crypto', provider);
    await launchPajaSharedIntent(h.state, h.context, h.intent, h.progress, vi.fn());
    expect(h.windowIds).toHaveLength(1);
    expect(h.windowIds[0]).toMatch(new RegExp(`^paja:intent-launcher:${UUID_V4}$`));
    expect(posted).toHaveLength(1);
    expect(posted[0]!.correlation).toMatch(new RegExp(`^${UUID_V4}$`));
    expect(h.windowIds[0]).not.toContain(posted[0]!.correlation);
    expect(provider.getRandomValues).toHaveBeenCalledTimes(2);
    expect(h.progress.accepted).toHaveBeenCalledOnce();
  });

  it('refuses to open a launcher frame without secure randomness', async () => {
    const h = harness();
    vi.stubGlobal('crypto', {});
    await expect(launchPajaSharedIntent(h.state, h.context, h.intent, h.progress, vi.fn()))
      .rejects.toThrow('@kehto/shell requires crypto.randomUUID or crypto.getRandomValues');
    expect(h.context.navigateFrame).not.toHaveBeenCalled();
    expect(posted).toEqual([]);
  });
});
