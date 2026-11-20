import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import { computeAggregateHash } from '@kehto/nip/5a';
import { resolveNapplet } from '@kehto/nip/5d';
import { originRegistry, resolveShellEnvironment, type ShellAdapter } from '@kehto/shell';
import type { Runtime } from '@kehto/runtime';
import { createPajaAdmissionTestRuntime } from './browser-admission-test-runtime.js';
import { navigateFrame } from './browser-target-frame.js';

/** A host page carrying the frame-src lock that navigateFrame requires. */
const LOCKED_HOST = { querySelectorAll: () => [{ content: "frame-src 'none'" }] };
import { InstalledNappletCatalog } from './installed-napplet-catalog.js';
import type { PajaHostConfig } from './options.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';

/** Captured before any test stubs the global, so stubs can delegate real entropy. */
const nativeCrypto = globalThis.crypto;

const html = '<html><head><title>fixture</title></head><body>Verified bytes</body></html>';
const bytes = new TextEncoder().encode(html);
async function sha256hex(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value.slice().buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
const hash = await sha256hex(bytes);
const sk = new Uint8Array(32).fill(0x11);
const config = { target: { mode: 'runtime-pointer' }, window: { id: 'test' } } as PajaHostConfig;
const adapter = { capabilities: { disabledDomains: ['keys'] } } as unknown as ShellAdapter;
let runtime: Runtime;

beforeEach(() => {
  runtime = createPajaAdmissionTestRuntime();
});

async function target(format: 'current' | 'legacy', requires = ['relay', 'shell'], kind = 35129, optional = ['keys', 'inc']): Promise<PajaResolvedPointer> {
  const tags = [
    ...(kind === 35129 ? [['d', 'test']] : []),
    ...(format === 'current' ? [
      ['x', hash], ...requires.map((domain) => ['R', domain]), ...optional.map((domain) => ['O', domain]),
      ['z', 'note'], ['i', 'napplet:note/open', 'filters'],
    ] : [
      ['path', '/index.html', hash], ['x', computeAggregateHash([{ path: '/index.html', sha256: hash }]), 'aggregate'],
      ...[...requires, 'inc'].map((domain) => ['requires', domain]), ['archetype', 'note', 'napplet:note/open'],
    ]),
  ];
  const event = finalizeEvent({ kind, created_at: 1, content: 'Test napplet', tags }, sk);
  const resolved = await resolveNapplet({ event, fetchBlob: async () => bytes });
  return { ...resolved, event, pointer: { type: 'nevent', value: 'test-pointer', id: event.id, relays: [] }, relays: [], blossomServers: [] };
}

afterEach(() => { runtime.destroy(); originRegistry.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function stubDevelopmentHtml(html: string): void {
  const requestUrl = 'http://paja.test/__kehto/target.html';
  vi.stubGlobal('window', { location: { href: 'http://paja.test/' } });
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, status: 200, statusText: 'OK', redirected: false, url: requestUrl,
    arrayBuffer: async () => new TextEncoder().encode(html).buffer,
  })));
}

describe.each(['current', 'legacy'] as const)('%s Paja frame admission', (format) => {
  it.each([35129, 15129, 5129])('binds kind %i identity before injected srcdoc and preserves verified bytes', async (kind) => {
    const resolved = await target(format, ['relay', 'shell'], kind);
    const win = {} as Window;
    let output = '';
    const frame = {
      contentWindow: win, ownerDocument: LOCKED_HOST, getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn(),
      set srcdoc(value: string) {
        expect(originRegistry.getIdentity(win)).toEqual({ dTag: resolved.dTag, aggregateHash: resolved.aggregateHash,
          permissionPrincipal: { kind: 'verified', manifestKey: resolved.manifest.catalogId, artifactHash: resolved.aggregateHash } });
        output = value;
      },
    } as unknown as HTMLIFrameElement;
    await navigateFrame(frame, config, 1, adapter, runtime, resolved);
    expect(output).toContain('<body>Verified bytes</body>');
    expect(output).toContain('Content-Security-Policy');
    expect(output).toContain('shell.ready');
    expect(resolved.indexHtml).toBe(html);
    expect(await sha256hex(bytes)).toBe(hash);
    expect(originRegistry.getEnvironment(win)?.capabilities.domains).not.toContain('keys');
    expect(originRegistry.getIdentity({} as Window)).toBeUndefined();
  });
  it.each(['unavailable', 'keys'])('blocks when required %s is unavailable before executable bytes', async (domain) => {
    const resolved = await target(format, [domain]);
    const win = {} as Window;
    const frame = { contentWindow: win, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
    await expect(navigateFrame(frame, config, 1, adapter, runtime, resolved)).rejects.toThrow(/admission denied/);
    expect(frame.srcdoc).toBe('');
    expect(originRegistry.getIdentity(win)).toBeUndefined();
  });
  it('derives equivalent intent eligibility from R/inc or O/inc declarations without granting them', async () => {
    const resolved = await target(format);
    const catalog = new InstalledNappletCatalog();
    catalog.install(resolved);
    expect(catalog.intentCatalog((record) => resolveShellEnvironment(adapter, record).capabilities.domains.includes('inc'))[0].archetypes).toEqual({ note: { contracts: [{ convention: 'napplet:note/open', params: format === 'current' ? ['filters'] : [] }] } });
    expect(catalog.installed()[0].requires).not.toContain('keys');
  });
});

it('admits a verified frame with a secure session instanceId when crypto.randomUUID is missing (kehto/web#351)', async () => {
  const resolved = await target('current');
  const frame = { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  // Non-localhost HTTP: getRandomValues exists, randomUUID and subtle do not.
  const provider = {
    getRandomValues: vi.fn(function (this: unknown, bytes: Uint8Array) {
      if (this !== provider) throw new TypeError('Illegal invocation');
      return nativeCrypto.getRandomValues(bytes);
    }),
  };
  vi.stubGlobal('crypto', provider);
  const windowId = await navigateFrame(frame, config, 7, adapter, runtime, resolved);
  expect(windowId).toBe('test:7');
  expect(runtime.sessionRegistry.getEntryByWindowId('test:7')?.instanceId)
    .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(provider.getRandomValues).toHaveBeenCalled();
  expect(frame.srcdoc).toContain('Verified bytes');
});

it('refuses frame admission instead of minting a weak instanceId without secure randomness', async () => {
  const resolved = await target('current');
  const frame = { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  vi.stubGlobal('crypto', {});
  await expect(navigateFrame(frame, config, 8, adapter, runtime, resolved)).rejects.toThrow('@kehto/shell requires crypto.randomUUID or crypto.getRandomValues');
  expect(frame.srcdoc).toBe('');
  expect(runtime.sessionRegistry.getEntryByWindowId('test:8')).toBeUndefined();
});

it('keeps roots and snapshots under publisher-safe catalog IDs without conflating their empty d-tags', async () => {
  const catalog = new InstalledNappletCatalog();
  const named = await target('current');
  const namedRecord = catalog.install(named);
  const changed = vi.fn();
  catalog.onChanged(changed);
  for (const kind of [15129, 5129]) {
    const nameless = await target('current', [], kind);
    catalog.install(nameless);
    expect(catalog.installed()).toHaveLength(kind === 15129 ? 2 : 3);
  }
  expect(changed).toHaveBeenCalledTimes(2);
  expect(catalog.intentCatalog(() => true).map((entry) => entry.id)).toContain(namedRecord.id);
});

it('loads optional-INC artifacts with INC disabled without advertising a handler', async () => {
  const resolved = await target('current', []);
  const catalog = new InstalledNappletCatalog();
  catalog.install(resolved);
  const disabled = { capabilities: { disabledDomains: ['inc'] } } as unknown as ShellAdapter;
  const frame = { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  await navigateFrame(frame, config, 1, disabled, runtime, resolved);
  expect(frame.srcdoc).toContain('Verified bytes');
  expect(originRegistry.getEnvironment(frame.contentWindow!)?.capabilities.domains).not.toContain('inc');
  expect(catalog.intentCatalog((record) => resolveShellEnvironment(disabled, record).capabilities.domains.includes('inc'))).toEqual([]);
  expect(catalog.get(resolved.manifest.catalogId)?.requires).toEqual([]);
});

// NIP-5D #2303@020cb8b: missing O domains MUST NOT prevent loading.
it.each([35129, 15129, 5129])('loads kind %i with unknown optional domains quietly', async (kind) => {
  const resolved = await target('current', [], kind, ['experimental-nap', 'keys']);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const frame = { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  await navigateFrame(frame, config, 1, adapter, runtime, resolved);
  expect(frame.srcdoc).toContain('Verified bytes');
  expect(resolved.manifest.optional).toEqual(['experimental-nap', 'keys']);
  expect(originRegistry.getEnvironment(frame.contentWindow!)?.capabilities.domains).not.toContain('experimental-nap');
  expect(originRegistry.getEnvironment(frame.contentWindow!)?.capabilities.domains).not.toContain('keys');
  expect(warn).not.toHaveBeenCalled();
});

it('does not warn or execute for a stale navigation with unavailable requirements', async () => {
  const resolved = await target('current', ['experimental-nap']);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const frame = { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  expect(await navigateFrame(frame, config, 1, adapter, runtime, resolved, { isCurrent: () => false })).toBeNull();
  expect(frame.srcdoc).toBe('');
  expect(originRegistry.getIdentity(frame.contentWindow!)).toBeUndefined();
  expect(warn).not.toHaveBeenCalled();
});

it('holds verified bytes until approval and aborts a replaced frame without registering it', async () => {
  let answer!: (value: { effect: 'allow'; lifetime: 'session' }) => void;
  let shown!: () => void;
  const visible = new Promise<void>((resolve) => { shown = resolve; });
  runtime.destroy();
  runtime = createPajaAdmissionTestRuntime(() => {
    shown();
    return new Promise((resolve) => { answer = resolve; });
  });
  const resolved = await target('current', ['shell']);
  const frame = { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null),
    setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  const controller = new AbortController();
  const pending = navigateFrame(frame, config, 1, adapter, runtime, resolved,
    { windowId: 'old-generation', isCurrent: () => !controller.signal.aborted, signal: controller.signal });
  await visible;
  expect(frame.srcdoc).toBe('');
  expect(originRegistry.getIdentity(frame.contentWindow!)).toBeUndefined();
  controller.abort();
  answer({ effect: 'allow', lifetime: 'session' });
  expect(await pending).toBeNull();
  expect(frame.srcdoc).toBe('');
  expect(originRegistry.getWindowId(frame.contentWindow!)).toBeUndefined();
});

it('narrows denied optional interfaces and keeps discovery hints outside direct CSP authority', async () => {
  runtime.destroy();
  runtime = createPajaAdmissionTestRuntime(async ({ missing }) => ({
    effect: missing.some((requirement) => requirement.domain === 'inc') ? 'deny' : 'allow',
    lifetime: 'session',
  }));
  const resolved = { ...await target('current', ['shell'], 35129, ['inc']),
    relays: ['wss://relay.example.test'], blossomServers: ['https://blossom.example.test'] };
  const frame = { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null),
    setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  expect(await navigateFrame(frame, config, 1, adapter, runtime, resolved)).toBe('test:1');
  expect(originRegistry.getEnvironment(frame.contentWindow!)?.capabilities.domains).toEqual(['shell']);
  expect(frame.srcdoc).toContain("connect-src 'none'");
  expect(frame.srcdoc).not.toContain('relay.example.test');
  expect(frame.srcdoc).not.toContain('blossom.example.test');
});

it('admits a live development URL with exact asset and HMR origins tied to fetched bytes', async () => {
  const prompts: string[] = [];
  runtime.destroy();
  runtime = createPajaAdmissionTestRuntime(async ({ missing }) => {
    prompts.push(...missing.map((item) => item.operation));
    return { effect: 'allow', lifetime: 'session' };
  });
  stubDevelopmentHtml('<html><head></head><body><script type="module" src="/src/main.ts"></script></body></html>');
  const dev = { target: { mode: 'iframe-url', url: 'http://127.0.0.1:5173/', hmrStrategy: 'iframe-target-url' },
    window: { id: 'dev', dTag: 'dev-app', aggregateHash: '0'.repeat(64) } } as PajaHostConfig;
  const frame = { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null),
    setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  expect(await navigateFrame(frame, dev, 1, adapter, runtime)).toBe('dev:1');
  const identity = originRegistry.getIdentity(frame.contentWindow!);
  expect(identity?.permissionPrincipal).toMatchObject({ kind: 'development', target: 'http://127.0.0.1:5173/' });
  expect(identity?.aggregateHash).toMatch(/^[a-f0-9]{64}$/);
  expect(frame.srcdoc).toContain('script-src');
  expect(frame.srcdoc).toContain('http://127.0.0.1:5173');
  expect(frame.srcdoc).toContain('ws://127.0.0.1:5173');
  expect(originRegistry.getEnvironment(frame.contentWindow!)?.capabilities.domains).not.toContain('resource');
  expect(prompts).toContain('network.script-src');
  expect(prompts).toContain('network.connect-src');
});

const DEV_CONFIG = { target: { mode: 'iframe-url', url: 'http://127.0.0.1:5173/', hmrStrategy: 'iframe-target-url' },
  window: { id: 'dev', dTag: 'dev-app', aggregateHash: '0'.repeat(64) } } as PajaHostConfig;
const RESOURCE_ADAPTER = { services: { resource: {} } } as unknown as ShellAdapter;
function devFrame(): HTMLIFrameElement {
  return { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null),
    setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
}
function recordPrompts(): string[] {
  const prompts: string[] = [];
  runtime.destroy();
  runtime = createPajaAdmissionTestRuntime(async ({ missing }) => {
    prompts.push(...missing.map((item) => item.operation));
    return { effect: 'allow', lifetime: 'session' };
  });
  return prompts;
}

// kehto/web#447, NAP-RESOURCE PR #80 at ae5b9c64ab8a4d8909f288829a01e99d6bd713bc:
// `resource` needs a frame with no direct network, external subresources included.
it('admits a target-URL document requiring resource as a network-isolated snapshot', async () => {
  const prompts = recordPrompts();
  const source = '<html><head><meta name="napplet-requires" content="resource"></head><body><script>1</script></body></html>';
  stubDevelopmentHtml(source);
  const frame = devFrame();
  expect(await navigateFrame(frame, DEV_CONFIG, 1, RESOURCE_ADAPTER, runtime)).toBe('dev:1');
  const csp = /Content-Security-Policy" content="([^"]*)"/.exec(frame.srcdoc)?.[1] ?? '';
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("connect-src 'none'");
  expect(csp).toContain("base-uri 'none'");
  expect(csp).toContain('img-src data: blob:');
  expect(csp).toContain("media-src 'none'");
  expect(csp).toContain("worker-src 'none'");
  expect(frame.srcdoc).not.toContain('127.0.0.1:5173');
  expect(frame.srcdoc).not.toContain('<base');
  expect(frame.srcdoc).toContain('<body><script>1</script></body>');
  expect(originRegistry.getEnvironment(frame.contentWindow!)?.capabilities.domains).toContain('resource');
  expect(originRegistry.getIdentity(frame.contentWindow!)?.permissionPrincipal)
    .toMatchObject({ kind: 'development', target: 'http://127.0.0.1:5173/' });
  expect(prompts.filter((operation) => operation.startsWith('network.'))).toEqual([]);
});

it('keeps a target-URL document with optional resource live and leaves resource out', async () => {
  const prompts = recordPrompts();
  stubDevelopmentHtml('<html><head><meta name="napplet-optional" content="resource theme"></head><body><script type="module" src="/src/main.ts"></script></body></html>');
  const frame = devFrame();
  expect(await navigateFrame(frame, DEV_CONFIG, 1, RESOURCE_ADAPTER, runtime)).toBe('dev:1');
  expect(frame.srcdoc).toContain('<base href="http://127.0.0.1:5173/">');
  expect(frame.srcdoc).toContain('ws://127.0.0.1:5173');
  expect(originRegistry.getEnvironment(frame.contentWindow!)?.capabilities.domains).not.toContain('resource');
  expect(prompts).toContain('network.connect-src');
  expect(prompts).not.toContain('resource');
});

it('still refuses required resource when the host config grants the frame direct origins', async () => {
  const prompt = vi.fn(async () => ({ effect: 'allow' as const, lifetime: 'session' as const }));
  runtime.destroy();
  runtime = createPajaAdmissionTestRuntime(prompt);
  stubDevelopmentHtml('<meta name="napplet-requires" content="resource"><script>1</script>');
  const open = { ...DEV_CONFIG, csp: { connectOrigins: ['https://api.example.test'] } } as PajaHostConfig;
  const frame = devFrame();
  await expect(navigateFrame(frame, open, 1, RESOURCE_ADAPTER, runtime))
    .rejects.toThrow(/incompatible: resource\. This napplet requires `resource`, but the host CSP config grants/);
  expect(prompt).not.toHaveBeenCalled();
  expect(frame.srcdoc).toBe('');
  expect(originRegistry.getIdentity(frame.contentWindow!)).toBeUndefined();
});

async function frameDeclaringTarget(
  requires: readonly string[] = ['shell'],
  frameHtml = '<html><head><title>evil</title></head><body><iframe srcdoc="x"></iframe></body></html>',
): Promise<PajaResolvedPointer> {
  const frameBytes = new TextEncoder().encode(frameHtml);
  const frameHash = await sha256hex(frameBytes);
  const event = finalizeEvent({ kind: 35129, created_at: 1, content: 'frame napplet', tags: [['d', 'frame'], ['x', frameHash], ...requires.map((domain) => ['R', domain])] }, sk);
  const resolvedBase = await resolveNapplet({ event, fetchBlob: async () => frameBytes });
  return { ...resolvedBase, event, pointer: { type: 'nevent', value: 'p', id: event.id, relays: [] }, relays: [], blossomServers: [] } as unknown as PajaResolvedPointer;
}

// The `auto` → privacy-sensitive-domain decision is unit-tested directly in
// nested-context-lock.test.ts (resolveNestedContextLock), independent of the
// shell environment's domain-granting internals.

it('with the experimental lock on, refuses a verified napplet whose markup declares a nested browsing context', async () => {
  const lockedConfig = { ...config, experimental: { nestedContextLock: 'on' } } as PajaHostConfig;
  const resolved = await frameDeclaringTarget();
  const win = {} as Window;
  let assigned = '';
  const frame = {
    contentWindow: win, ownerDocument: LOCKED_HOST, getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn(),
    set srcdoc(value: string) { assigned = value; },
  } as unknown as HTMLIFrameElement;
  await expect(navigateFrame(frame, lockedConfig, 1, adapter, runtime, resolved)).rejects.toThrow(/nested browsing context/);
  expect(assigned).toBe('');
});

it('with the experimental lock on, refuses a verified napplet whose markup declares a resource hint', async () => {
  const lockedConfig = { ...config, experimental: { nestedContextLock: 'on' } } as PajaHostConfig;
  const resolved = await frameDeclaringTarget(['shell'], '<html><head><link rel="preconnect" href="https://collector.example"></head><body></body></html>');
  let assigned = '';
  const frame = {
    contentWindow: {} as Window, ownerDocument: LOCKED_HOST, getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn(),
    set srcdoc(value: string) { assigned = value; },
  } as unknown as HTMLIFrameElement;
  await expect(navigateFrame(frame, lockedConfig, 1, adapter, runtime, resolved)).rejects.toThrow(/dns-prefetch, preconnect or prerender/);
  expect(assigned).toBe('');
});

it('with the experimental lock on, carries Trusted Types and prelude pins through Firewall admission', async () => {
  const lockedConfig = { ...config, experimental: { nestedContextLock: 'on' } } as PajaHostConfig;
  const resolved = await target('current', ['shell']);
  const frame = { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  await navigateFrame(frame, lockedConfig, 1, adapter, runtime, resolved);
  expect(frame.srcdoc).toContain("require-trusted-types-for 'script'");
  expect(frame.srcdoc).toContain("frame-src 'none'");
  // The resource-hint lock rides on the same decision.
  expect(frame.srcdoc).toContain('dns-prefetch, preconnect or prerender');
  expect(frame.setAttribute).toHaveBeenCalledWith('referrerpolicy', 'no-referrer');
});

it('without the experimental lock, loads a frame-declaring napplet unchanged (opt-in gate)', async () => {
  const resolved = await frameDeclaringTarget();
  const win = {} as Window;
  const frame = {
    contentWindow: win, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn(),
  } as unknown as HTMLIFrameElement;
  await navigateFrame(frame, config, 1, adapter, runtime, resolved);
  expect(frame.srcdoc).toContain('<iframe srcdoc="x">');
  expect(frame.srcdoc).not.toContain('require-trusted-types-for');
});

it('refuses to load a napplet on a host page without the frame-src lock', async () => {
  const resolved = await target('current', ['relay', 'shell'], 35129);
  const frame = { contentWindow: {} as Window, ownerDocument: { querySelectorAll: () => [] }, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  await expect(navigateFrame(frame, config, 1, adapter, runtime, resolved)).rejects.toThrow(/frame-src lock/);
  expect(frame.srcdoc).toBe('');
  expect(originRegistry.getIdentity(frame.contentWindow!)).toBeUndefined();
});
