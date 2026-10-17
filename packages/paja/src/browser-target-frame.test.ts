import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import { computeAggregateHash } from '@kehto/nip/5a';
import { resolveNapplet } from '@kehto/nip/5d';
import { originRegistry, resolveShellEnvironment, type ShellAdapter } from '@kehto/shell';
import type { Runtime } from '@kehto/runtime';
import { createPajaAdmissionTestRuntime } from './browser-admission-test-runtime.js';
import { navigateFrame } from './browser-target-frame.js';
import { InstalledNappletCatalog } from './installed-napplet-catalog.js';
import type { PajaHostConfig } from './options.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';

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
      contentWindow: win, getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn(),
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
    const frame = { contentWindow: win, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
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
  const frame = { contentWindow: {} as Window, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
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
  const frame = { contentWindow: {} as Window, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
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
  const frame = { contentWindow: {} as Window, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  expect(await navigateFrame(frame, config, 1, adapter, runtime, resolved, undefined, () => false)).toBeNull();
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
  const frame = { contentWindow: {} as Window, srcdoc: '', getAttribute: vi.fn(() => null),
    setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  const controller = new AbortController();
  const pending = navigateFrame(frame, config, 1, adapter, runtime, resolved,
    'old-generation', () => !controller.signal.aborted, undefined, controller.signal);
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
  const frame = { contentWindow: {} as Window, srcdoc: '', getAttribute: vi.fn(() => null),
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
  const frame = { contentWindow: {} as Window, srcdoc: '', getAttribute: vi.fn(() => null),
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

it('rejects a live development document requiring resource before approval or execution', async () => {
  const prompt = vi.fn(async () => ({ effect: 'allow' as const, lifetime: 'session' as const }));
  runtime.destroy();
  runtime = createPajaAdmissionTestRuntime(prompt);
  stubDevelopmentHtml('<meta name="napplet-requires" content="resource"><script type="module" src="/src/main.ts"></script>');
  const dev = { target: { mode: 'iframe-url', url: 'http://127.0.0.1:5173/', hmrStrategy: 'iframe-target-url' },
    window: { id: 'dev', dTag: 'dev-app', aggregateHash: '0'.repeat(64) } } as PajaHostConfig;
  const frame = { contentWindow: {} as Window, srcdoc: '', getAttribute: vi.fn(() => null),
    setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  await expect(navigateFrame(frame, dev, 1, adapter, runtime)).rejects.toThrow(/incompatible: resource/);
  expect(prompt).not.toHaveBeenCalled();
  expect(frame.srcdoc).toBe('');
  expect(originRegistry.getIdentity(frame.contentWindow!)).toBeUndefined();
});
