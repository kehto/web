import { afterEach, describe, expect, it, vi } from 'vitest';
import { originRegistry } from '@kehto/shell';
import type { Runtime } from '@kehto/runtime';
import type { NappletInfo } from '../../apps/playground/src/shell-host.js';
import { loadPlaygroundNapplet } from '../../apps/playground/src/playground-frame-loader.js';

const resolved = vi.hoisted(() => ({
  catalogId: 'verified-catalog-key', dTag: 'verified-demo', aggregateHash: 'a'.repeat(64),
  requires: ['relay'], optional: ['resource'], archetypes: [],
  indexHtml: '<!doctype html><html><head></head><body>verified artifact</body></html>',
}));
vi.mock('../../apps/playground/src/napplet-resolver.js', () => ({
  PLAYGROUND_MANIFEST_AUTHOR: 'author', resolvePlaygroundNapplet: vi.fn(async () => resolved),
}));
vi.mock('../../apps/playground/src/demo-hooks.js', () => ({
  getMissingRequiredNaps: () => [],
  getPlaygroundShellEnvironment: () => ({
    capabilities: { domains: ['shell', 'relay', 'resource'] },
    services: ['relay', 'resource'],
  }),
}));

interface FakeFrame extends HTMLIFrameElement {
  isConnected: boolean;
  srcdoc: string;
}

function fixture() {
  const frames: FakeFrame[] = [];
  const container = { appendChild(frame: FakeFrame) { frame.isConnected = true; } };
  vi.stubGlobal('document', {
    createElement(tag: string) {
      expect(tag).toBe('iframe');
      const frame = {
        id: '', className: '', isConnected: false, srcdoc: '',
        contentWindow: { postMessage: vi.fn() },
        sandbox: { add: vi.fn() },
        getAttribute: () => null,
        setAttribute: vi.fn(),
        addEventListener: vi.fn(),
        remove() { frame.isConnected = false; },
      } as unknown as FakeFrame;
      frames.push(frame);
      return frame;
    },
    getElementById: () => container,
  });
  const entries = new Map<string, unknown>();
  let finishAdmission!: (result: { status: 'admitted' | 'denied'; domains: string[]; deniedRequired: string[] }) => void;
  const admission = new Promise<{ status: 'admitted' | 'denied'; domains: string[]; deniedRequired: string[] }>((resolve) => {
    finishAdmission = resolve;
  });
  const admit = vi.fn(() => admission);
  const runtime = {
    sessionRegistry: {
      register: (windowId: string, entry: unknown) => entries.set(windowId, entry),
      getEntryByWindowId: (windowId: string) => entries.get(windowId),
      unregister: (windowId: string) => entries.delete(windowId),
    },
    permissions: { admit, isAdmissionCurrent: () => true, subscribeInvalidation: () => () => {} },
    destroyWindow: vi.fn(),
  } as unknown as Runtime;
  const napplets = new Map<string, NappletInfo>();
  const host = {
    napplets,
    getRuntime: () => runtime,
    clearIntentGeneration: vi.fn(),
    installVerifiedNapplet: vi.fn(),
  };
  return { frames, entries, napplets, host, admit, finishAdmission, runtime };
}

describe('playground verified frame admission', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    originRegistry.clear();
  });

  it('keeps verified bytes inert until the exact manifest interfaces are admitted', async () => {
    const setup = fixture();
    const loading = loadPlaygroundNapplet(setup.host, resolved.dTag, 'target');
    await vi.waitFor(() => expect(setup.admit).toHaveBeenCalledOnce());
    expect(setup.frames[0]?.srcdoc).toBe('');
    expect(setup.admit).toHaveBeenCalledWith(expect.any(String), {
      available: ['shell', 'relay', 'resource'], required: ['relay'], optional: ['resource'], launchRequirements: [],
    });
    const entry = [...setup.entries.values()][0] as { permissionPrincipal: unknown };
    expect(entry.permissionPrincipal).toEqual({
      kind: 'verified', manifestKey: resolved.catalogId, artifactHash: resolved.aggregateHash,
    });
    setup.finishAdmission({ status: 'admitted', domains: ['relay'], deniedRequired: [] });
    const info = await loading;
    expect(info.environment.capabilities.domains).toEqual(['shell', 'relay']);
    expect(info.environment.services).toEqual(['relay']);
    expect(setup.frames[0]?.srcdoc).toContain('verified artifact');
    expect(setup.frames[0]?.srcdoc).toContain('data-kehto-nip5d-injection');
    expect(setup.frames[0]?.srcdoc).toContain("connect-src 'none'");
  });

  it('never injects bytes after required denial and removes the provisional source', async () => {
    const setup = fixture();
    const loading = loadPlaygroundNapplet(setup.host, resolved.dTag, 'target');
    await vi.waitFor(() => expect(setup.admit).toHaveBeenCalledOnce());
    setup.finishAdmission({ status: 'denied', domains: [], deniedRequired: ['relay'] });
    await expect(loading).rejects.toThrow('admission denied: relay');
    expect(setup.frames[0]?.srcdoc).toBe('');
    expect(setup.frames[0]?.isConnected).toBe(false);
    expect(setup.napplets.size).toBe(0);
  });

  it('rejects a catalog replacement while approval is pending', async () => {
    const setup = fixture();
    let selected = true;
    const loading = loadPlaygroundNapplet(setup.host, resolved.dTag, 'target', {
      acceptResolved: () => selected,
    });
    await vi.waitFor(() => expect(setup.admit).toHaveBeenCalledOnce());
    selected = false;
    setup.finishAdmission({ status: 'admitted', domains: ['relay'], deniedRequired: [] });
    await expect(loading).rejects.toThrow('admission cancelled');
    expect(setup.frames[0]?.srcdoc).toBe('');
    expect(setup.napplets.size).toBe(0);
  });

  it('cannot revive a frame closed during its approval', async () => {
    const setup = fixture();
    const loading = loadPlaygroundNapplet(setup.host, resolved.dTag, 'target');
    await vi.waitFor(() => expect(setup.admit).toHaveBeenCalledOnce());
    const info = [...setup.napplets.values()][0];
    info?.dispose?.();
    setup.finishAdmission({ status: 'admitted', domains: ['relay'], deniedRequired: [] });
    await expect(loading).rejects.toThrow('admission cancelled');
    expect(setup.frames[0]?.srcdoc).toBe('');
    expect(setup.napplets.size).toBe(0);
  });
});
