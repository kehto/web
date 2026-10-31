import { describe, expect, it, vi } from 'vitest';
import { buildShellCapabilities, getShellDomainState } from '@kehto/shell';
import type { LlmGenerationRequest, LlmProviderEndpoint } from '@kehto/services';
import { createPajaAdapter, type PajaConfirmationRequest } from './browser-adapter.js';
import {
  PAJA_LLM_CONNECTIONS_STORAGE_KEY,
  createPajaLlmConnectionStore,
  createPajaLlmHost,
  describePajaLlmRoute,
  normalizePajaLlmBaseUrl,
  type PajaLlmConnectionRecord,
} from './browser-llm-connections.js';
import { createPajaLlmVault } from './browser-llm-vault.js';
import type { PajaHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  key(index: number): string | null { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, value); }
}

const KEY = 'sk-test-secret';
const IDENTITY = { dTag: 'assistant', aggregateHash: 'a'.repeat(64) };
const OPENAI: PajaLlmConnectionRecord = { id: 'c-openai', name: 'OpenAI', presetId: 'openai', protocol: 'openai-chat', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', images: true, json: true, credentialStorage: 'vault' };
const OLLAMA: PajaLlmConnectionRecord = { id: 'c-ollama', name: 'Local', presetId: 'ollama', protocol: 'openai-chat', baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2', images: false, json: false, credentialStorage: 'none' };
const REQUEST: LlmGenerationRequest = { handle: 'h', messages: [{ role: 'user', content: [{ type: 'text', text: 'hello there' }, { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' }] }], format: 'json' };
const fastVault = () => createPajaLlmVault({ storage: new MemoryStorage(), iterations: 1000 });

describe('Paja LLM connection store', () => {
  it('normalises base URLs and refuses credential-leaking or plaintext remote endpoints', () => {
    expect(normalizePajaLlmBaseUrl(' https://api.openai.com/v1/ ')).toBe('https://api.openai.com/v1');
    expect(normalizePajaLlmBaseUrl('http://localhost:11434/v1')).toBe('http://localhost:11434/v1');
    expect(() => normalizePajaLlmBaseUrl('http://api.example.com/v1')).toThrow(/HTTPS/);
    expect(() => normalizePajaLlmBaseUrl('https://user:pw@api.example.com/v1')).toThrow(/credentials/);
    expect(() => normalizePajaLlmBaseUrl('https://api.example.com/v1?key=x')).toThrow(/query/);
    expect(() => normalizePajaLlmBaseUrl('not a url')).toThrow(/absolute/);
  });

  it('persists validated metadata only and notifies subscribers', () => {
    const storage = new MemoryStorage();
    const store = createPajaLlmConnectionStore(storage);
    const changes = vi.fn();
    store.subscribe(changes);
    store.save(OPENAI);
    store.save(OLLAMA);
    expect(store.list().map((record) => record.id)).toEqual(['c-openai', 'c-ollama']);
    expect(storage.getItem(PAJA_LLM_CONNECTIONS_STORAGE_KEY)).not.toContain(KEY);
    expect(() => store.save({ ...OPENAI, name: '' })).toThrow(/name/);
    expect(() => store.save({ ...OPENAI, protocol: 'soap' as never })).toThrow(/protocol/);
    store.save({ ...OPENAI, model: 'gpt-4.1' });
    expect(store.get('c-openai')?.model).toBe('gpt-4.1');
    expect(store.remove('c-openai')).toBe(true);
    expect(store.remove('c-openai')).toBe(false);
    expect(changes).toHaveBeenCalledTimes(4);
    const reopened = createPajaLlmConnectionStore(storage);
    expect(reopened.list()).toEqual([expect.objectContaining({ id: 'c-ollama' })]);
    storage.setItem(PAJA_LLM_CONNECTIONS_STORAGE_KEY, JSON.stringify([{ id: 'bad', baseUrl: 'http://evil.example' }, OLLAMA]));
    expect(createPajaLlmConnectionStore(storage).list()).toHaveLength(1);
  });

  it('describes a disclosure route without credentials', () => {
    expect(describePajaLlmRoute(OPENAI)).toBe('Paja (this browser) → OpenAI at https://api.openai.com');
    expect(describePajaLlmRoute({ ...OLLAMA, presetId: 'custom' })).toBe('Paja (this browser) → http://127.0.0.1:11434');
  });
});

function harness(records: PajaLlmConnectionRecord[], overrides: { confirm?: (request: PajaConfirmationRequest) => boolean | Promise<boolean>; choose?: PajaLlmConnectionRecord | null; unlock?: boolean } = {}) {
  const store = createPajaLlmConnectionStore(new MemoryStorage());
  for (const record of records) store.save(record);
  const vault = fastVault();
  const confirm = vi.fn(overrides.confirm ?? (() => true));
  const chooseConnection = vi.fn(async (candidates: readonly PajaLlmConnectionRecord[]) => overrides.choose === undefined ? candidates[0] ?? null : overrides.choose);
  const requestUnlock = vi.fn(async () => overrides.unlock ?? false);
  const openPanel = vi.fn();
  const provider = vi.fn(async (_endpoint: LlmProviderEndpoint, _request: LlmGenerationRequest, _signal: AbortSignal) => ({ text: '{"ok":true}', finish: 'stop' as const }));
  const host = createPajaLlmHost({ store, vault, confirm, chooseConnection, requestUnlock, openPanel, getIdentity: () => IDENTITY, provider });
  return { store, vault, confirm, chooseConnection, requestUnlock, openPanel, provider, host };
}

describe('Paja LLM host', () => {
  it('prompts to configure when nothing compatible exists and answers unsupported or user-cancelled', async () => {
    const approved = harness([], { confirm: () => true });
    await expect(approved.host.select({ windowId: 'w1' }, { json: true })).rejects.toMatchObject({ code: 'unsupported', message: /Language models/ });
    expect(approved.confirm).toHaveBeenCalledWith(expect.objectContaining({ action: 'llm-configure', windowId: 'w1', napplet: IDENTITY, requirements: 'any model, JSON output', configured: 0 }));
    expect(approved.openPanel).toHaveBeenCalledOnce();
    expect(approved.chooseConnection).not.toHaveBeenCalled();
    expect(approved.host.isConfigured()).toBe(false);

    const declined = harness([OLLAMA], { confirm: () => false });
    await expect(declined.host.select({ windowId: 'w1' }, { images: true })).resolves.toBeNull();
    expect(declined.openPanel).not.toHaveBeenCalled();
    expect(declined.host.isConfigured()).toBe(true);
  });

  it('offers only compatible connections, maps the chooser result and revalidates by id', async () => {
    const h = harness([OPENAI, OLLAMA]);
    const model = await h.host.select({ windowId: 'w1' }, { images: true });
    expect(h.chooseConnection).toHaveBeenCalledWith([expect.objectContaining({ id: 'c-openai' })], { windowId: 'w1', napplet: IDENTITY, requirements: { images: true } });
    expect(model).toEqual({ id: 'c-openai', name: 'OpenAI', model: 'gpt-4.1-mini', route: 'Paja (this browser) → OpenAI at https://api.openai.com', images: true, json: true });
    expect(JSON.stringify(model)).not.toContain(KEY);
    expect(h.host.describe({ windowId: 'w1' }, 'c-ollama')).toMatchObject({ id: 'c-ollama', json: false });
    h.store.remove('c-ollama');
    expect(h.host.describe({ windowId: 'w1' }, 'c-ollama')).toBeNull();
    const declined = harness([OPENAI], { choose: null });
    await expect(declined.host.select({ windowId: 'w1' }, {})).resolves.toBeNull();
  });

  it('asks for disclosure consent with counts and route but never prompt text or credentials', async () => {
    const h = harness([OLLAMA]);
    const connection = (await h.host.describe({ windowId: 'w1' }, 'c-ollama'))!;
    await expect(h.host.authorize({ windowId: 'w1' }, connection, REQUEST)).resolves.toBe(true);
    const request = h.confirm.mock.calls[0]![0] as PajaConfirmationRequest;
    expect(request).toMatchObject({ action: 'llm', windowId: 'w1', napplet: IDENTITY, connection: 'Local', model: 'llama3.2', messages: 1, characters: 11, images: 1, format: 'json' });
    expect(JSON.stringify(request)).not.toContain('hello there');
    expect(JSON.stringify(request)).not.toContain('iVBOR');
  });

  it('unlocks the vault before consent and sends the credential only on the provider request', async () => {
    const h = harness([OPENAI], { unlock: true });
    await h.vault.create('correct horse battery staple');
    await h.vault.setCredential('c-openai', KEY, 'vault');
    h.vault.lock();
    h.requestUnlock.mockImplementation(async () => h.vault.unlock('correct horse battery staple'));
    const connection = (await h.host.describe({ windowId: 'w1' }, 'c-openai'))!;
    await expect(h.host.authorize({ windowId: 'w1' }, connection, REQUEST)).resolves.toBe(true);
    expect(h.requestUnlock).toHaveBeenCalledOnce();
    expect(JSON.stringify(h.confirm.mock.calls[0])).not.toContain(KEY);
    const controller = new AbortController();
    await expect(h.host.generate({ windowId: 'w1' }, connection, REQUEST, { signal: controller.signal, onDelta: () => undefined })).resolves.toEqual({ text: '{"ok":true}', finish: 'stop' });
    expect(h.provider).toHaveBeenCalledWith({ protocol: 'openai-chat', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', credential: KEY }, REQUEST, controller.signal);
  });

  it('fails typed when the vault stays locked or a session key is gone, and for removed connections', async () => {
    const locked = harness([OPENAI], { unlock: false });
    await locked.vault.create('correct horse battery staple');
    locked.vault.lock();
    const connection = (await locked.host.describe({ windowId: 'w1' }, 'c-openai'))!;
    await expect(locked.host.authorize({ windowId: 'w1' }, connection, REQUEST)).rejects.toMatchObject({ code: 'user-cancelled' });
    expect(locked.confirm).not.toHaveBeenCalled();

    const session = harness([{ ...OPENAI, id: 'c-session', credentialStorage: 'session' }]);
    const sessionConnection = (await session.host.describe({ windowId: 'w1' }, 'c-session'))!;
    await expect(session.host.generate({ windowId: 'w1' }, sessionConnection, REQUEST, { signal: new AbortController().signal, onDelta: () => undefined })).rejects.toMatchObject({ code: 'unsupported', message: /session/ });
    expect(session.openPanel).toHaveBeenCalledOnce();
    expect(session.provider).not.toHaveBeenCalled();

    session.store.remove('c-session');
    await expect(session.host.authorize({ windowId: 'w1' }, sessionConnection, REQUEST)).rejects.toMatchObject({ code: 'selection-expired' });
  });

  it('threads the service prompt signal into the chooser, configure, unlock and consent prompts', async () => {
    const chooser = harness([OPENAI]);
    const selecting = new AbortController();
    await chooser.host.select({ windowId: 'w1' }, {}, { signal: selecting.signal });
    expect(chooser.chooseConnection).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ signal: selecting.signal }));

    const configure = harness([], { confirm: () => false });
    await configure.host.select({ windowId: 'w1' }, {}, { signal: selecting.signal });
    expect(configure.confirm).toHaveBeenCalledWith(expect.objectContaining({ action: 'llm-configure', signal: selecting.signal }));

    const consent = harness([OPENAI], { unlock: false });
    await consent.vault.create('correct horse battery staple');
    await consent.vault.setCredential('c-openai', KEY, 'vault');
    consent.vault.lock();
    const connection = (await consent.host.describe({ windowId: 'w1' }, 'c-openai'))!;
    const prompt = new AbortController();
    consent.requestUnlock.mockImplementation(async () => consent.vault.unlock('correct horse battery staple'));
    await expect(consent.host.authorize({ windowId: 'w1' }, connection, REQUEST, { signal: prompt.signal })).resolves.toBe(true);
    expect(consent.requestUnlock).toHaveBeenCalledWith(prompt.signal);
    expect(consent.confirm).toHaveBeenCalledWith(expect.objectContaining({ action: 'llm', signal: prompt.signal }));

    const withdrawn = harness([OLLAMA]);
    const local = (await withdrawn.host.describe({ windowId: 'w1' }, 'c-ollama'))!;
    await expect(withdrawn.host.authorize({ windowId: 'w1' }, local, REQUEST, { signal: AbortSignal.abort() })).resolves.toBe(false);
    expect(withdrawn.confirm).not.toHaveBeenCalled();
  });

  it('notifies the service when connections or the vault change', async () => {
    const h = harness([OPENAI]);
    const listener = vi.fn();
    const stop = h.host.subscribe!(listener);
    h.store.save(OLLAMA);
    await h.vault.create('correct horse battery staple');
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    h.store.remove('c-ollama');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('Paja adapter NAP-LLM wiring', () => {
  const CONFIG = { window: { id: 'llm-window', dTag: 'assistant', aggregateHash: 'llm-hash' } } as PajaHostConfig;
  const simulation = (domains: Record<string, boolean> = {}) => normalizePajaSimulation({ relay: { mode: 'disabled' }, capabilities: { domains } });

  it('advertises llm with the host and reports unconfigured until a connection exists', () => {
    const h = harness([]);
    const adapter = createPajaAdapter(CONFIG, () => simulation(), () => {}, () => {}, () => true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => [], h.host);
    expect(adapter.services?.llm?.descriptor.name).toBe('llm');
    expect(buildShellCapabilities(adapter).domains).toContain('llm');
    expect(getShellDomainState(adapter, 'llm')).toBe('unconfigured');
    h.store.save(OLLAMA);
    expect(getShellDomainState(adapter, 'llm')).toBe('supported');
  });

  it('omits llm without a host or when the simulation disables the domain', () => {
    const withoutHost = createPajaAdapter(CONFIG, () => simulation(), () => {}, () => {}, () => true);
    expect(withoutHost.services?.llm).toBeUndefined();
    expect(buildShellCapabilities(withoutHost).domains).not.toContain('llm');
    expect(getShellDomainState(withoutHost, 'llm')).toBe('disabled');
    const disabled = createPajaAdapter(CONFIG, () => simulation({ llm: false }), () => {}, () => {}, () => true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, () => [], harness([OLLAMA]).host);
    expect(disabled.services?.llm).toBeUndefined();
    expect(getShellDomainState(disabled, 'llm')).toBe('disabled');
  });
});
