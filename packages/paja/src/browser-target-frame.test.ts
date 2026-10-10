import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import { computeAggregateHash } from '@kehto/nip/5a';
import { resolveNapplet } from '@kehto/nip/5d';
import { originRegistry, resolveShellEnvironment, type ShellAdapter } from '@kehto/shell';
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

async function target(format: 'current' | 'legacy', requires = ['relay', 'shell'], kind = 35129): Promise<PajaResolvedPointer> {
  const tags = [
    ...(kind === 35129 ? [['d', 'test']] : []),
    ...(format === 'current' ? [
      ['x', hash], ...requires.map((domain) => ['R', domain]), ['O', 'keys'], ['O', 'inc'],
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

afterEach(() => originRegistry.clear());

describe.each(['current', 'legacy'] as const)('%s Paja frame admission', (format) => {
  it.each([35129, 15129, 5129])('binds kind %i identity before injected srcdoc and preserves verified bytes', async (kind) => {
    const resolved = await target(format, ['relay', 'shell'], kind);
    const win = {} as Window;
    let output = '';
    const frame = {
      contentWindow: win, removeAttribute: vi.fn(),
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
  it('rejects a missing required domain before registration or execution', async () => {
    const resolved = await target(format, ['unavailable']);
    const win = {} as Window;
    const frame = { contentWindow: win, srcdoc: '', removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
    await expect(navigateFrame(frame, config, 1, adapter, resolved)).rejects.toThrow(/unavailable/);
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
  const frame = { contentWindow: {} as Window, srcdoc: '', removeAttribute: vi.fn() } as unknown as HTMLIFrameElement;
  await navigateFrame(frame, config, 1, disabled, resolved);
  expect(frame.srcdoc).toContain('Verified bytes');
  expect(originRegistry.getEnvironment(frame.contentWindow!)?.capabilities.domains).not.toContain('inc');
  expect(catalog.intentCatalog((record) => resolveShellEnvironment(disabled, record).capabilities.domains.includes('inc'))).toEqual([]);
  expect(catalog.get(resolved.manifest.catalogId)?.requires).toEqual([]);
});
