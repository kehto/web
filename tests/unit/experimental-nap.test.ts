import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RESERVED_NAP_DOMAINS,
  ShellExtensionError,
  buildShellCapabilities,
  createShellBridge,
  getShellDomainState,
  getShellExtensionBindings,
  originRegistry,
  renderNappletNamespacePrelude,
  validateExtensionDomain,
  type ShellAdapter,
} from '@kehto/shell';
import createPajaEchoExtension, { createEchoExtension, settings as echoSettings } from '../fixtures/experimental-nap/x-echo.js';
import {
  PAJA_ADVERTISED_DOMAINS,
  PAJA_SIMULATION_DOMAINS,
  getUnexpectedAdvertisedDomains,
  startPajaServer,
} from '../../packages/paja/src/index.js';
import { loadPajaExtensions } from '../../packages/paja/src/browser-extensions.js';

// The x-echo fixture is an out-of-tree experimental NAP: it uses only public
// @kehto/* entry points (type imports) and changes no kehto package. Kehto
// spec-gap policy, bounded by napplet/naps master 43cb3a4.
const fixtureDir = resolve(__dirname, '../fixtures/experimental-nap');
const fixturePath = join(fixtureDir, 'x-echo.js');
const identity = { dTag: 'echo-probe', aggregateHash: 'c'.repeat(64) };
const windowId = 'echo-window';

function hooks(extra: Partial<ShellAdapter> = {}): ShellAdapter {
  return {
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'banner' },
    crypto: { verifyEvent: async () => false },
    hotkeys: { executeHotkeyFromForward() {} },
    windowManager: { createWindow: () => null },
    relayConfig: { addRelay() {}, removeRelay() {}, getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }), getNip66Suggestions: () => [] },
    relayPool: {
      getRelayPool: () => null, trackSubscription() {}, untrackSubscription() {},
      openScopedRelay() {}, closeScopedRelay() {}, publishToScopedRelay: () => false, selectRelayTier: () => [],
    },
    workerRelay: { getWorkerRelay: () => null },
    ...extra,
  };
}

function host(prefix: { value?: string }, extra: Partial<ShellAdapter> = {}, firewallAllow = true) {
  const adapter = hooks({ extensions: [createEchoExtension({ getPrefix: () => prefix.value })], ...extra });
  const bridge = createShellBridge(adapter);
  if (firewallAllow) bridge.runtime.firewallState.setPolicy(identity.dTag, 'allow');
  const postMessage = vi.fn();
  const win = { postMessage } as unknown as Window;
  originRegistry.register(win, windowId, identity);
  const send = (data: Record<string, unknown>) => bridge.handleMessage({ source: win, origin: 'null', data } as MessageEvent);
  const replies = () => postMessage.mock.calls.map(([message]) => message);
  return { adapter, bridge, send, replies };
}

describe('x-echo experimental NAP on the shell', () => {
  beforeEach(() => originRegistry.clear());
  afterEach(() => originRegistry.clear());

  it('is advertised, answers supports(), and moves from unconfigured to supported', () => {
    const prefix: { value?: string } = {};
    const { adapter, bridge, send, replies } = host(prefix);
    expect(buildShellCapabilities(adapter).domains).toContain('x-echo');
    send({ type: 'shell.ready' });
    expect(replies()[0]).toMatchObject({ type: 'shell.init', capabilities: { domains: expect.arrayContaining(['x-echo']) } });
    expect(getShellDomainState(adapter, 'x-echo')).toBe('unconfigured');
    send({ type: 'x-echo.say', id: 'early', text: 'hi' });
    expect(replies().at(-1)).toEqual({ type: 'x-echo.say.result', id: 'early', error: { code: 'not-configured', message: 'Set an echo prefix first.' } });
    prefix.value = 'echo: ';
    expect(getShellDomainState(adapter, 'x-echo')).toBe('supported');
    bridge.destroy();
  });

  it('round-trips a request and delivers the push event', () => {
    const { bridge, send, replies } = host({ value: '> ' });
    send({ type: 'x-echo.say', id: 'r1', text: 'hello' });
    expect(replies()).toEqual([
      { type: 'x-echo.say.result', id: 'r1', text: '> hello' },
      { type: 'x-echo.heard', text: '> hello' },
    ]);
    bridge.destroy();
  });

  it('honors ACL deny for the request and for the push separately', () => {
    const { bridge, send, replies } = host({ value: '> ' });
    bridge.runtime.aclState.revoke('', identity.dTag, identity.aggregateHash, 'x-echo:listen');
    send({ type: 'x-echo.say', id: 'r1', text: 'a' });
    expect(replies()).toEqual([{ type: 'x-echo.say.result', id: 'r1', text: '> a' }]);
    bridge.runtime.aclState.revoke('', identity.dTag, identity.aggregateHash, 'x-echo:send');
    send({ type: 'x-echo.say', id: 'r2', text: 'b' });
    expect(replies()).toHaveLength(1);
    bridge.destroy();
  });

  it('is dropped by a firewall block without an invented envelope', () => {
    const { bridge, send, replies } = host({ value: '> ' }, {}, false);
    bridge.runtime.firewallState.addMatcher({ id: 'no-echo', opClass: 'x-echo:send', action: 'block' });
    send({ type: 'x-echo.say', id: 'r1', text: 'a' });
    expect(replies()).toEqual([]);
    bridge.destroy();
  });

  it('is withheld from a frame whose resolveEnvironment disables it', () => {
    const { bridge, send, replies } = host({ value: '> ' }, {
      capabilities: { resolveEnvironment: (_id, available) => ({ domains: available.domains.filter((d) => d !== 'x-echo'), services: available.services }) },
    });
    send({ type: 'shell.ready' });
    expect((replies()[0] as { capabilities: { domains: string[] } }).capabilities.domains).not.toContain('x-echo');
    send({ type: 'x-echo.say', id: 'r1', text: 'a' });
    expect(replies()).toHaveLength(1);
    bridge.destroy();
  });

  it('rejects a colliding declaration', () => {
    const echo = createEchoExtension({ getPrefix: () => 'x' });
    expect(() => createShellBridge(hooks({ extensions: [{ ...echo, domain: 'llm' }] }))).toThrow(ShellExtensionError);
    expect(() => createShellBridge(hooks({ extensions: [echo, echo] }))).toThrow(/declared twice/);
  });

  it('renders its binding into the prelude only', () => {
    const extension = createEchoExtension({ getPrefix: () => 'x' });
    const prelude = renderNappletNamespacePrelude({ domains: ['x-echo'], extensions: getShellExtensionBindings([extension], ['x-echo']) });
    expect(prelude).toMatch(/^<script data-kehto-nip5d-extension>/);
    expect(prelude).toContain("kit.request('say'");
  });
});

describe('x-echo experimental NAP in Paja', () => {
  it('serves the configured module and loads it into a settings-backed extension', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'paja-x-echo-'));
    const config = join(dir, 'paja.config.json');
    writeFileSync(config, JSON.stringify({ extensions: [{ module: fixturePath, settings: { prefix: 'cfg: ' } }] }), 'utf8');
    const server = await startPajaServer({ options: { targetUrl: 'http://127.0.0.1:9', port: 0, configPath: config } });
    try {
      expect(server.hostConfig.extensions).toEqual([{ url: '/__kehto/extensions/0.js', name: 'x-echo.js', enabled: true, settings: { prefix: 'cfg: ' }, deniedDTags: [] }]);
      const served = await fetch(new URL('/__kehto/extensions/0.js', server.url)).then((response) => response.text());
      expect(served).toBe(readFileSync(fixturePath, 'utf8'));
      const html = await fetch(server.url).then((response) => response.text());
      expect(html).toContain('id="paja-section-extensions"');
    } finally {
      await server.close();
    }
    const { loaded, failures } = await loadPajaExtensions(
      { extensions: [{ url: 'fixture', name: 'x-echo.js', enabled: true, settings: { prefix: 'cfg: ' } }] },
      ['llm'],
      () => import('../fixtures/experimental-nap/x-echo.js'),
    );
    expect(failures).toEqual([]);
    expect(loaded[0].extension.domain).toBe('x-echo');
    expect(loaded[0].settings).toEqual(echoSettings);
    expect(loaded[0].extension.state?.()).toBe('supported');
  });

  it('matches extension routes on the pathname and answers a generic 404 for an unreadable module (IN-06)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'paja-x-route-'));
    const config = join(dir, 'paja.config.json');
    writeFileSync(config, JSON.stringify({ extensions: [{ module: join(dir, 'missing.js') }, { module: fixturePath }] }), 'utf8');
    const server = await startPajaServer({ options: { targetUrl: 'http://127.0.0.1:9', port: 0, configPath: config } });
    try {
      const served = await fetch(new URL('/__kehto/extensions/1.js?v=1', server.url));
      expect(served.status).toBe(200);
      expect(await served.text()).toBe(readFileSync(fixturePath, 'utf8'));
      for (const path of ['/__kehto/extensions/0.js', '/__kehto/extensions/0.js?v=2']) {
        const missing = await fetch(new URL(path, server.url));
        const body = await missing.text();
        expect(missing.status).toBe(404);
        expect(body).toBe('Not found');
        expect(body).not.toContain(dir);
      }
    } finally {
      await server.close();
    }
  });

  it('resolves config-relative module paths and reports policy failures without breaking others', async () => {
    const server = await startPajaServer({ options: { targetUrl: 'http://127.0.0.1:9', port: 0, configPath: join(fixtureDir, 'paja.config.json') } });
    try {
      expect(server.hostConfig.extensions?.[0].name).toBe('x-echo.js');
    } finally {
      await server.close();
    }
    const { loaded, failures } = await loadPajaExtensions(
      { extensions: [
        { url: 'echo', name: 'x-echo.js', enabled: true, settings: {} },
        { url: 'shadow', name: 'shadow.js', enabled: true, settings: {} },
        { url: 'llm', name: 'shadow-llm.js', enabled: true, settings: {} },
      ] },
      [],
      async (url) => {
        if (url === 'shadow') return { default: (context: Parameters<typeof createPajaEchoExtension>[0]) => ({ ...createPajaEchoExtension(context), domain: 'x-llm' }) };
        if (url === 'llm') return import('../fixtures/experimental-nap/shadow-llm.js');
        return import('../fixtures/experimental-nap/x-echo.js');
      },
    );
    expect(failures).toEqual([
      { name: 'shadow.js', reason: expect.stringMatching(/aliases the reserved NAP domain llm/) },
      { name: 'shadow-llm.js', reason: expect.stringMatching(/reserved NAP domain/) },
    ]);
    expect(loaded.map((item) => item.extension.domain)).toEqual(['x-echo']);
    expect(loaded[0].extension.state?.()).toBe('unconfigured');
  });
});

describe('Paja extension context surface', () => {
  it('hands a factory only settings, never vault, signer or other host state', async () => {
    let seen: Record<string, unknown> | undefined;
    await loadPajaExtensions(
      { extensions: [{ url: 'spy', name: 'spy.js', enabled: true, settings: { prefix: 'p' } }] },
      [],
      async () => ({ default: (context: Record<string, unknown>) => { seen = context; return createEchoExtension({ getPrefix: () => 'p' }); } }),
    );
    expect(Object.keys(seen ?? {})).toEqual(['settings']);
    expect(Object.keys((seen?.settings ?? {}) as object)).toEqual(['get']);
  });

  it('keys stored settings by domain, not module file name (WR-07)', async () => {
    const store = new Map<string, string>([['kehto.paja.extension.x-echo', JSON.stringify({ prefix: 'stored>' })], ['kehto.paja.extension.index.js', JSON.stringify({ prefix: 'other>' })]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    try {
      const { loaded } = await loadPajaExtensions(
        { extensions: [{ url: 'a', name: 'index.js', enabled: true, settings: {} }] },
        [],
        () => import('../fixtures/experimental-nap/x-echo.js'),
      );
      expect(loaded[0].values).toEqual({ prefix: 'stored>' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('flags advertised domains that are neither Paja built-ins nor loaded extensions', () => {
    expect(getUnexpectedAdvertisedDomains({ domains: ['shell', 'llm', 'x-echo'] }, ['x-echo'])).toEqual([]);
    expect(getUnexpectedAdvertisedDomains({ domains: ['shell', 'x-echo', 'x-rogue'] }, ['x-echo'])).toEqual(['x-rogue']);
  });

  it('reserves every domain Paja advertises or simulates, and rejects its x- alias', () => {
    // HC-1 drift guard: a new in-tree domain must be added to RESERVED_NAP_DOMAINS,
    // or an extension could claim its x- alias.
    const domains = [...new Set<string>([...PAJA_ADVERTISED_DOMAINS, ...PAJA_SIMULATION_DOMAINS])];
    expect(domains.length).toBeGreaterThan(0);
    for (const domain of domains) {
      expect(RESERVED_NAP_DOMAINS, domain).toContain(domain);
      expect(validateExtensionDomain(domain), domain).not.toBeNull();
      expect(validateExtensionDomain(`x-${domain}`), `x-${domain}`).not.toBeNull();
    }
  });
});

describe('x-echo fixture types', () => {
  it('type-checks against the published @kehto/shell and @kehto/paja declarations', () => {
    expect(() => execFileSync('npx', ['tsc', '-p', join(fixtureDir, 'tsconfig.json')], { stdio: 'pipe', timeout: 60_000 })).not.toThrow();
  }, 70_000);
});
