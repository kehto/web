/**
 * Paja's NAP-LLM connection store and runtime host.
 *
 * Connection metadata (name, protocol, base URL, model, capabilities) is plain
 * host configuration in `localStorage`. Credentials live in the separate
 * {@link PajaLlmVault}. The host implements the service's
 * `LlmConnectionHost` seam: it shows the chooser, asks for disclosure consent
 * before every generation, resolves the credential and calls the provider.
 * The credential is placed only on the request to the connection's own base URL.
 */

import {
  LLM_PROVIDER_PRESETS,
  LlmServiceError,
  buildLlmProviderRequest,
  createHttpLlmProvider,
  countLlmImages,
  type HttpLlmProvider,
  type LlmConnection,
  type LlmConnectionHost,
  type LlmCredentialHeader,
  type LlmGenerationRequest,
  type LlmPromptOptions,
  type LlmProviderEndpoint,
  type LlmProviderProtocol,
  type LlmRequestContext,
  type LlmRequirements,
  type LlmToolChoiceMode,
} from '@kehto/services';
import type { PajaConfirmationHandler } from './browser-adapter.js';
import type { PajaLlmCredentialStorage, PajaLlmVault } from './browser-llm-vault.js';

/** Durable storage key for connection metadata (never credentials). */
export const PAJA_LLM_CONNECTIONS_STORAGE_KEY = 'kehto:paja:llm-connections:v1';
const MAX_CONNECTIONS = 32;
const PROTOCOLS = new Set<LlmProviderProtocol>(['openai-chat', 'anthropic-messages', 'gemini']);
const CREDENTIAL_HEADERS = new Set<LlmCredentialHeader>(['authorization-bearer', 'api-key', 'x-api-key', 'x-goog-api-key']);
/** Canonical order of stored tool-choice modes; `auto` and `none` are always supported when tools are on. */
const TOOL_CHOICE_ORDER: readonly LlmToolChoiceMode[] = ['auto', 'none', 'required', 'tool'];
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** One saved provider connection. Credentials are referenced, never embedded. */
export interface PajaLlmConnectionRecord {
  readonly id: string;
  readonly name: string;
  readonly presetId: string;
  readonly protocol: LlmProviderProtocol;
  readonly baseUrl: string;
  readonly model: string;
  readonly images: boolean;
  readonly json: boolean;
  /** Tool calling support; rows saved before it existed omit it and load as off. */
  readonly tools?: boolean;
  /** Supported tool-choice modes in canonical order; stored as `[]` when tools are off. */
  readonly toolChoiceModes?: readonly LlmToolChoiceMode[];
  readonly credentialHeader?: LlmCredentialHeader;
  readonly credentialStorage: PajaLlmCredentialStorage;
}

/** Observable connection list with validated writes. */
export interface PajaLlmConnectionStore {
  list(): readonly PajaLlmConnectionRecord[];
  get(id: string): PajaLlmConnectionRecord | undefined;
  /** Validate and persist; returns the stored record or throws a user-facing Error. */
  save(record: PajaLlmConnectionRecord): PajaLlmConnectionRecord;
  remove(id: string): boolean;
  subscribe(listener: () => void): () => void;
}

/**
 * Normalise and validate an API base URL for a provider connection.
 *
 * HTTPS is required except for loopback hosts, so a remembered key can only
 * travel encrypted to the configured server or to the user's own machine.
 *
 * @param value - User-entered URL.
 * @returns The canonical origin plus path without a trailing slash.
 * @throws Error with user-facing text for an unusable URL.
 * @example normalizePajaLlmBaseUrl('https://api.openai.com/v1/'); // 'https://api.openai.com/v1'
 */
export function normalizePajaLlmBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter an absolute API base URL.'); }
  if (url.username || url.password) throw new Error('The base URL must not embed credentials.');
  if (url.search || url.hash) throw new Error('The base URL must not include a query or fragment.');
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('Use HTTPS, or HTTP only for a server on this machine (localhost / 127.0.0.1).');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Canonical modes: empty when tools are off; otherwise ordered, de-duplicated, with `auto` and `none` always present. */
function canonicalToolChoiceModes(tools: boolean, requested: unknown): LlmToolChoiceMode[] {
  if (!tools) return [];
  const wanted = new Set<unknown>(Array.isArray(requested) ? requested : []);
  return TOOL_CHOICE_ORDER.filter((mode) => mode === 'auto' || mode === 'none' || wanted.has(mode));
}

function normalizeRecord(input: Record<string, unknown>): PajaLlmConnectionRecord {
  const text = (value: unknown): string => typeof value === 'string' ? value : '';
  const name = text(input.name).trim();
  const model = text(input.model).trim();
  const id = text(input.id);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid connection id.');
  if (!name || name.length > 64) throw new Error('Enter a connection name of up to 64 characters.');
  if (!model || model.length > 200) throw new Error('Enter the exact provider model identifier.');
  const protocol = input.protocol as LlmProviderProtocol;
  const credentialHeader = input.credentialHeader as LlmCredentialHeader | undefined;
  const credentialStorage = input.credentialStorage as PajaLlmCredentialStorage;
  if (!PROTOCOLS.has(protocol)) throw new Error('Unknown provider protocol.');
  if (credentialHeader !== undefined && !CREDENTIAL_HEADERS.has(credentialHeader)) throw new Error('Unknown credential header.');
  if (!['vault', 'session', 'none'].includes(credentialStorage)) throw new Error('Unknown credential storage.');
  const tools = input.tools === true;
  const record: PajaLlmConnectionRecord = {
    id, name, presetId: text(input.presetId).slice(0, 64), protocol,
    baseUrl: normalizePajaLlmBaseUrl(text(input.baseUrl)), model, images: input.images === true, json: input.json === true,
    tools, toolChoiceModes: Object.freeze(canonicalToolChoiceModes(tools, input.toolChoiceModes)),
    credentialStorage,
    ...(credentialHeader ? { credentialHeader } : {}),
  };
  return Object.freeze(record);
}

function readRecords(storage: Storage | null): PajaLlmConnectionRecord[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PAJA_LLM_CONNECTIONS_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const records: PajaLlmConnectionRecord[] = [];
    for (const entry of parsed) {
      if (!isRecord(entry) || records.length >= MAX_CONNECTIONS) continue;
      try { records.push(normalizeRecord(entry)); } catch { /* skip corrupt row */ }
    }
    return records;
  } catch {
    return [];
  }
}

function storageOrNull(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/**
 * Create the connection store.
 *
 * @param storage - Durable storage or null for session-only connections.
 * @returns An observable, validated connection list.
 * @example const store = createPajaLlmConnectionStore();
 */
export function createPajaLlmConnectionStore(storage: Storage | null = storageOrNull()): PajaLlmConnectionStore {
  let records = readRecords(storage);
  const listeners = new Set<() => void>();
  const persist = (): void => {
    try { storage?.setItem(PAJA_LLM_CONNECTIONS_STORAGE_KEY, JSON.stringify(records)); } catch { /* session-only */ }
    for (const listener of listeners) listener();
  };
  return {
    list: () => records,
    get: (id) => records.find((record) => record.id === id),
    save(record) {
      const normalized = normalizeRecord({ ...record });
      const index = records.findIndex((entry) => entry.id === normalized.id);
      if (index === -1 && records.length >= MAX_CONNECTIONS) throw new Error(`Paja keeps at most ${MAX_CONNECTIONS} connections.`);
      records = index === -1 ? [...records, normalized] : records.map((entry, position) => position === index ? normalized : entry);
      persist();
      return normalized;
    },
    remove(id) {
      const next = records.filter((record) => record.id !== id);
      if (next.length === records.length) return false;
      records = next;
      persist();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Who is asking, for chooser and consent copy. */
export interface PajaLlmRequestIdentity {
  readonly dTag: string;
  readonly aggregateHash: string;
}

/** UI and policy callbacks the Paja host needs from the page. */
export interface PajaLlmHostOptions {
  store: PajaLlmConnectionStore;
  vault: PajaLlmVault;
  /** Host confirmation dialog shared with signer, upload and other operations. */
  confirm: PajaConfirmationHandler;
  /** Show the connection chooser; resolve null when the user declines or `context.signal` aborts. */
  chooseConnection(candidates: readonly PajaLlmConnectionRecord[], context: PajaLlmChooserContext): Promise<PajaLlmConnectionRecord | null>;
  /** Ask for the vault password; resolve false when the user cancels or `signal` aborts. */
  requestUnlock(signal?: AbortSignal): Promise<boolean>;
  /** Reveal and focus the Language models panel. */
  openPanel(): void;
  /** Resolve the napplet identity bound to a runtime window. */
  getIdentity(windowId: string): PajaLlmRequestIdentity;
  /** Provider transport; defaults to the streaming fetch-based provider. */
  provider?: HttpLlmProvider;
}

/** What the connection chooser shows for one `llm.select`. */
export interface PajaLlmChooserContext {
  readonly windowId: string;
  readonly napplet: PajaLlmRequestIdentity;
  readonly requirements: LlmRequirements;
  /** Aborts when the selection settles without the user's answer; close the chooser. */
  readonly signal?: AbortSignal;
}

/** Paja's NAP-LLM host plus the configuration probe the shell adapter needs. */
export interface PajaLlmHost extends LlmConnectionHost {
  /** True when at least one connection exists. */
  isConfigured(): boolean;
}

/**
 * Describe the disclosure route for a connection without credentials.
 * @param record - Saved connection.
 * @returns Human-readable route from this browser to the provider origin.
 * @example describePajaLlmRoute(record); // 'Paja (this browser) → OpenAI at https://api.openai.com'
 */
export function describePajaLlmRoute(record: PajaLlmConnectionRecord): string {
  const preset = LLM_PROVIDER_PRESETS.find((entry) => entry.id === record.presetId);
  const origin = new URL(record.baseUrl).origin;
  const label = preset && preset.id !== 'custom' ? `${preset.label} at ${origin}` : origin;
  return `Paja (this browser) → ${label}`;
}

function toConnection(record: PajaLlmConnectionRecord): LlmConnection {
  const tools = record.tools === true;
  return {
    id: record.id, name: record.name, model: record.model, route: describePajaLlmRoute(record), images: record.images, json: record.json,
    tools, toolChoiceModes: tools ? canonicalToolChoiceModes(true, record.toolChoiceModes) : [],
  };
}

function meets(record: PajaLlmConnectionRecord, requirements: LlmRequirements): boolean {
  if (requirements.model !== undefined && requirements.model !== record.model) return false;
  if (requirements.images === true && !record.images) return false;
  if (requirements.tools === true && record.tools !== true) return false;
  return !(requirements.json === true && !record.json);
}

function describeRequirements(requirements: LlmRequirements): string {
  const parts = [
    requirements.model ? `model ${requirements.model}` : 'any model',
    requirements.images ? 'image input' : null,
    requirements.json ? 'JSON output' : null,
    requirements.tools ? 'tool calling' : null,
  ].filter((part): part is string => part !== null);
  return parts.join(', ');
}

/**
 * Characters that leave the page: text parts (tool results included), each
 * historical call's serialized arguments and each tool definition. Thinking is
 * excluded because the provider mapping omits it.
 */
function countCharacters(request: LlmGenerationRequest): number {
  let total = 0;
  for (const message of request.messages) {
    for (const part of message.content) {
      if (part.type === 'text') total += part.text.length;
      else if (part.type === 'toolCall') total += JSON.stringify(part.arguments).length;
    }
  }
  for (const tool of request.tools ?? []) total += JSON.stringify(tool).length;
  return total;
}

function countToolResults(request: LlmGenerationRequest): number {
  return request.messages.filter((message) => message.role === 'toolResult').length;
}

/**
 * Create Paja's NAP-LLM host.
 *
 * @param options - Store, vault, dialogs and provider transport.
 * @returns A host for `createLlmService({ host })` plus the configured probe.
 * @example
 * const host = createPajaLlmHost({ store, vault, confirm, chooseConnection, requestUnlock, openPanel, getIdentity });
 */
export function createPajaLlmHost(options: PajaLlmHostOptions): PajaLlmHost {
  const { store, vault, confirm, getIdentity } = options;
  // Stream so napplets see provisional `llm.delta` blocks; the final result stays authoritative.
  const provider = options.provider ?? createHttpLlmProvider({ stream: true });

  /** One place builds the provider endpoint, so the preflight and the real request agree. */
  function endpointFor(record: PajaLlmConnectionRecord, credential?: string): LlmProviderEndpoint {
    return {
      protocol: record.protocol,
      baseUrl: record.baseUrl,
      model: record.model,
      ...(credential === undefined ? {} : { credential }),
      ...(record.credentialHeader ? { credentialHeader: record.credentialHeader } : {}),
    };
  }

  async function ensureCredential(record: PajaLlmConnectionRecord, signal?: AbortSignal): Promise<string | undefined> {
    if (record.credentialStorage === 'none') return undefined;
    const existing = vault.getCredential(record.id);
    if (existing !== undefined) return existing;
    if (record.credentialStorage === 'session') {
      options.openPanel();
      throw new LlmServiceError('unsupported', 'This connection\'s API key was kept for one session only. Enter it again in Language models.');
    }
    if (!vault.isUnlocked()) {
      const unlocked = await options.requestUnlock(signal);
      if (!unlocked) throw new LlmServiceError('user-cancelled', 'The credential vault stayed locked.');
    }
    const credential = vault.getCredential(record.id);
    if (credential === undefined) {
      options.openPanel();
      throw new LlmServiceError('unsupported', 'No API key is stored for this connection. Enter it again in Language models.');
    }
    return credential;
  }

  async function select(context: LlmRequestContext, requirements: LlmRequirements, prompt?: LlmPromptOptions): Promise<LlmConnection | null> {
    const signal = prompt?.signal;
    const napplet = getIdentity(context.windowId);
    const candidates = store.list().filter((record) => meets(record, requirements));
    if (candidates.length === 0) {
      const configure = await confirm({ action: 'llm-configure', windowId: context.windowId, napplet, requirements: describeRequirements(requirements), configured: store.list().length, ...(signal ? { signal } : {}) });
      if (!configure) return null;
      options.openPanel();
      throw new LlmServiceError('unsupported', 'No compatible language model connection is configured yet. Add one in Paja\'s Language models panel, then select again.');
    }
    const chosen = await options.chooseConnection(candidates, { windowId: context.windowId, napplet, requirements, ...(signal ? { signal } : {}) });
    if (!chosen) return null;
    const current = store.get(chosen.id);
    return current && meets(current, requirements) ? toConnection(current) : null;
  }

  return {
    isConfigured: () => store.list().length > 0,
    select,
    describe(_context, connectionId) {
      const record = store.get(connectionId);
      return record ? toConnection(record) : null;
    },
    async authorize(context, connection, request, prompt) {
      const signal = prompt?.signal;
      const record = store.get(connection.id);
      if (!record) throw new LlmServiceError('selection-expired', 'The selected connection was removed; select again.');
      // Dialect restrictions answer `unsupported` before any vault unlock or consent prompt.
      // No credential goes in, and the built request is never sent.
      buildLlmProviderRequest(endpointFor(record), request, { stream: true });
      await ensureCredential(record, signal);
      if (signal?.aborted) return false;
      return confirm({
        ...(signal ? { signal } : {}),
        action: 'llm',
        windowId: context.windowId,
        napplet: getIdentity(context.windowId),
        connection: record.name,
        model: record.model,
        route: describePajaLlmRoute(record),
        messages: request.messages.length,
        characters: countCharacters(request),
        images: countLlmImages(request.messages),
        tools: (request.tools ?? []).map((tool) => tool.name),
        toolResults: countToolResults(request),
        format: request.format ?? 'text',
        warning: 'The prompt text, images, tool definitions and tool results disclosed here leave this device for the provider named in the route. Provider charges and retention follow that service\'s terms.',
      });
    },
    async generate(_context, connection, request, hooks) {
      const record = store.get(connection.id);
      if (!record) throw new LlmServiceError('selection-expired', 'The selected connection was removed; select again.');
      const credential = await ensureCredential(record);
      return provider(endpointFor(record, credential), request, hooks.signal, (event) => hooks.onDelta(event));
    },
    subscribe(listener) {
      const stopStore = store.subscribe(listener);
      const stopVault = vault.subscribe(listener);
      return () => { stopStore(); stopVault(); };
    },
  };
}
