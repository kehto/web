import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import { computeAggregateHash } from '@kehto/nip/5a';
import { resolveNapplet } from '@kehto/nip/5d';
import { originRegistry, resolveShellEnvironment, type ShellAdapter } from '@kehto/shell';
import { navigateFrame } from './browser-target-frame.js';

/** A host page carrying the frame-src lock that navigateFrame requires. */
const LOCKED_HOST = { querySelectorAll: () => [{ content: "frame-src 'none'" }] };
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

afterEach(() => { originRegistry.clear(); vi.restoreAllMocks(); });

describe.each(['current', 'legacy'] as const)('%s Paja frame admission', (format) => {
  it.each([35129, 15129, 5129])('binds kind %i identity before injected srcdoc and preserves verified bytes', async (kind) => {
    const resolved = await target(format, ['relay', 'shell'], kind);
    const win = {} as Window;
    let output = '';
    const frame = {
      contentWindow: win, ownerDocument: LOCKED_HOST, getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn(),
      set srcdoc(value: string) {
        expect(originRegistry.getIdentity(win)).toEqual({ dTag: resolved.dTag, aggregateHash: resolved.aggregateHash });
        output = value;
      },
    } as unknown as HTMLIFrameElement;
    await navigateFrame(frame, config, 1, adapter, resolved);
    expect(output).toContain('<body>Verified bytes</body>');
    expect(output).toContain('Content-Security-Policy');
    expect(output).toContain('shell.ready');
    expect(resolved.indexHtml).toBe(html);
    expect(await sha256hex(bytes)).toBe(hash);
    expect(originRegistry.getEnvironment(win)?.capabilities.domains).not.toContain('keys');
    expect(originRegistry.getIdentity({} as Window)).toBeUndefined();
  });
  it.each(['unavailable', 'keys'])('warns and loads when required %s is unavailable without granting it', async (domain) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = await target(format, [domain]);
    const win = {} as Window;
    const frame = { contentWindow: win, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
    await navigateFrame(frame, config, 1, adapter, resolved);
    expect(frame.srcdoc).toContain('Verified bytes');
    expect(originRegistry.getIdentity(win)?.aggregateHash).toBe(resolved.aggregateHash);
    expect(originRegistry.getEnvironment(win)?.capabilities.domains).not.toContain(domain);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining(`unsupported NAP capabilities: ${domain}`),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('full functionality may be unavailable'));
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
  const frame = { contentWindow: {} as Window, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  await navigateFrame(frame, config, 1, disabled, resolved);
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
  await navigateFrame(frame, config, 1, adapter, resolved);
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
  expect(await navigateFrame(frame, config, 1, adapter, resolved, undefined, () => false)).toBeNull();
  expect(frame.srcdoc).toBe('');
  expect(originRegistry.getIdentity(frame.contentWindow!)).toBeUndefined();
  expect(warn).not.toHaveBeenCalled();
});

async function frameDeclaringTarget(requires: readonly string[] = ['shell']): Promise<PajaResolvedPointer> {
  const frameHtml = '<html><head><title>evil</title></head><body><iframe srcdoc="x"></iframe></body></html>';
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
  await expect(navigateFrame(frame, lockedConfig, 1, adapter, resolved)).rejects.toThrow(/nested browsing context/);
  expect(assigned).toBe('');
});

it('without the experimental lock, loads a frame-declaring napplet unchanged (opt-in gate)', async () => {
  const resolved = await frameDeclaringTarget();
  const win = {} as Window;
  const frame = {
    contentWindow: win, ownerDocument: LOCKED_HOST, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn(),
  } as unknown as HTMLIFrameElement;
  await navigateFrame(frame, config, 1, adapter, resolved);
  expect(frame.srcdoc).toContain('<iframe srcdoc="x">');
  expect(frame.srcdoc).not.toContain('require-trusted-types-for');
});

it('refuses to load a napplet on a host page without the frame-src lock', async () => {
  const resolved = await target('current', ['relay', 'shell'], 35129);
  const frame = { contentWindow: {} as Window, ownerDocument: { querySelectorAll: () => [] }, srcdoc: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  await expect(navigateFrame(frame, config, 1, adapter, resolved)).rejects.toThrow(/frame-src lock/);
  expect(frame.srcdoc).toBe('');
  expect(originRegistry.getIdentity(frame.contentWindow!)).toBeUndefined();
});
