/**
 * NAP-LLM reference service.
 *
 * Authority: napplet/naps PR #134 (`nap-llm`) at
 * 3e10939cf788878bbdcc022c101f0ac6193f316c. The service owns request
 * correlation, endpoint-scoped handles, schema and capability checks, the
 * consent-before-submission gate, duplicate-id rejection, cancellation and
 * deadline races, ordered deltas, lifecycle cleanup and safe error shaping.
 * Hosts implement {@link LlmConnectionHost}: choosing a connection, revalidating
 * it, asking the user for disclosure consent and talking to the provider.
 * Credentials never reach this module; a host keeps them behind its adapter.
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import {
  LlmServiceError,
  type LlmFailure,
  type LlmGeneration,
  type LlmGenerationRequest,
  type LlmModel,
  type LlmRequirements,
} from './llm-types.js';
import {
  countLlmImages,
  isJsonObjectText,
  isLlmGeneration,
  isLlmGenerationRequest,
  isLlmRequirements,
  isNonemptyText,
} from './llm-validate.js';

/** A host-owned connection the user may select. `id` stays host-private. */
export interface LlmConnection {
  /** Stable host-private identifier; never crosses the napplet wire. */
  readonly id: string;
  /** User-facing connection label. */
  readonly name: string;
  /** Exact provider model identifier. */
  readonly model: string;
  /** Human-readable disclosure route: intermediaries and destination, never credentials. */
  readonly route: string;
  /** Whether the connection accepts image input. */
  readonly images: boolean;
  /** Whether the connection supports JSON-object output. */
  readonly json: boolean;
}

/** Which authenticated endpoint issued a request. */
export interface LlmRequestContext {
  /** Requesting live runtime window. */
  readonly windowId: string;
}

/** Hooks a provider call receives from the service. */
export interface LlmGenerateHooks {
  /** Aborted on cancellation, deadline, revocation or endpoint destruction. */
  readonly signal: AbortSignal;
  /** Append provisional text; the service numbers and routes the delta. */
  onDelta(text: string): void;
}

/**
 * Host adapter behind the NAP-LLM service.
 *
 * @example
 * ```ts
 * const host: LlmConnectionHost = {
 *   select: async (ctx, req) => chooser.pick(ctx.windowId, req),   // null when the user declines
 *   describe: (_ctx, id) => store.get(id) ?? null,
 *   authorize: async (ctx, connection, request) => consent.ask(ctx, connection, request),
 *   generate: (_ctx, connection, request, hooks) => provider.generate(connection, request, hooks),
 * };
 * ```
 */
export interface LlmConnectionHost {
  /**
   * Ask the user to choose a connection meeting the requirements. Return `null`
   * when the user declines (`user-cancelled`). Throw
   * `new LlmServiceError('unsupported', …)` when no compatible connection exists.
   */
  select(context: LlmRequestContext, requirements: LlmRequirements): Promise<LlmConnection | null> | LlmConnection | null;
  /** Revalidate a connection by host id; `null` when it no longer exists. */
  describe(context: LlmRequestContext, connectionId: string): Promise<LlmConnection | null> | LlmConnection | null;
  /** Obtain disclosure consent for one generation before any prompt content leaves the runtime. */
  authorize(context: LlmRequestContext, connection: LlmConnection, request: LlmGenerationRequest): Promise<boolean> | boolean;
  /** Perform the provider request. Throw `LlmServiceError` for typed failures; anything else becomes `provider-error`. */
  generate(
    context: LlmRequestContext,
    connection: LlmConnection,
    request: LlmGenerationRequest,
    hooks: LlmGenerateHooks,
  ): Promise<LlmGeneration>;
  /** Notify the service when connections, credentials or the account change so every handle expires. */
  subscribe?(listener: () => void): () => void;
}

/** Options for {@link createLlmService}. */
export interface LlmServiceOptions {
  /** Connection, consent and provider adapter. */
  host: LlmConnectionHost;
  /** Generation deadline including consent wait, in milliseconds. Default 120000. */
  deadlineMs?: number;
  /** Active generations allowed per window. Default 4. */
  maxConcurrentPerWindow?: number;
  /** Serialized request size ceiling in UTF-16 code units. Default 4 MiB. */
  maxRequestChars?: number;
  /** Opaque handle factory; defaults to `crypto.randomUUID` with a counter fallback. */
  createHandle?: () => string;
}

/** Created NAP-LLM service. */
export interface LlmService extends ServiceHandler {
  /** Expire every handle (account switch, connection or credential change). */
  invalidateHandles(): void;
  /** Cancel active work and expire handles for one endpoint. */
  revokeWindow(windowId: string): void;
  /** Number of generations currently in flight across all windows. */
  activeGenerations(): number;
}

type Send = (message: NappletMessage) => void;
type HandleEntry = { connectionId: string; snapshot: LlmConnection };
type ActiveGeneration = {
  readonly controller: AbortController;
  readonly send: Send;
  readonly format: 'text' | 'json';
  readonly epoch: number;
  sequence: number;
  settled: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
};
type ServiceState = {
  readonly host: LlmConnectionHost;
  readonly deadlineMs: number;
  readonly maxConcurrent: number;
  readonly maxRequestChars: number;
  readonly createHandle: () => string;
  readonly handles: Map<string, Map<string, HandleEntry>>;
  readonly active: Map<string, Map<string, ActiveGeneration>>;
  epoch: number;
  closed: boolean;
};

const DESCRIPTOR: ServiceDescriptor = {
  name: 'llm',
  version: '1.0.0',
  description: 'NAP-LLM user-selected language model inference',
};
const REQUEST_TYPES = new Set(['llm.select', 'llm.describe', 'llm.generate', 'llm.cancel']);
const CANCELLED: LlmFailure = { code: 'cancelled', message: 'Generation cancelled; provider charges may still apply.' };
const TIMEOUT: LlmFailure = { code: 'timeout', message: 'Generation deadline reached; provider charges may still apply.' };
const EXPIRED: LlmFailure = { code: 'selection-expired', message: 'Unknown or expired model handle; select again.' };

function failure(error: unknown): LlmFailure {
  if (error instanceof LlmServiceError) return { code: error.code, message: error.message };
  return { code: 'provider-error', message: 'The provider request failed.' };
}

function sameConnection(a: LlmConnection, b: LlmConnection): boolean {
  return a.id === b.id && a.name === b.name && a.model === b.model && a.route === b.route && a.images === b.images && a.json === b.json;
}

function meetsRequirements(connection: LlmConnection, requirements: LlmRequirements): boolean {
  if (requirements.model !== undefined && requirements.model !== connection.model) return false;
  if (requirements.images === true && !connection.images) return false;
  return !(requirements.json === true && !connection.json);
}

function toModel(handle: string, connection: LlmConnection): LlmModel {
  return { handle, name: connection.name, model: connection.model, route: connection.route, images: connection.images, json: connection.json };
}

function defaultHandleFactory(): () => string {
  let counter = 0;
  return () => {
    const random = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : Math.random().toString(16).slice(2);
    counter += 1;
    return `llm-${random}-${counter}`;
  };
}

function windowHandles(state: ServiceState, windowId: string): Map<string, HandleEntry> {
  let entries = state.handles.get(windowId);
  if (!entries) { entries = new Map(); state.handles.set(windowId, entries); }
  return entries;
}

function reply(send: Send, type: string, id: string, payload: Record<string, unknown>): void {
  send({ type: `${type}.result`, id, ...payload } as NappletMessage);
}

function settle(state: ServiceState, windowId: string, requestId: string, generation: ActiveGeneration, terminal: NappletMessage | null): void {
  if (generation.settled) return;
  generation.settled = true;
  if (generation.timer !== undefined) clearTimeout(generation.timer);
  const perWindow = state.active.get(windowId);
  if (perWindow?.get(requestId) === generation) {
    perWindow.delete(requestId);
    if (perWindow.size === 0) state.active.delete(windowId);
  }
  generation.controller.abort();
  if (terminal) generation.send(terminal);
}

function failGeneration(state: ServiceState, windowId: string, requestId: string, generation: ActiveGeneration, error: LlmFailure): void {
  settle(state, windowId, requestId, generation, { type: 'llm.generate.result', id: requestId, error } as NappletMessage);
}

function cancelWindow(state: ServiceState, windowId: string, error: LlmFailure | null): void {
  for (const [requestId, generation] of state.active.get(windowId) ?? []) {
    settle(state, windowId, requestId, generation, error ? { type: 'llm.generate.result', id: requestId, error } as NappletMessage : null);
  }
}

function invalidateHandles(state: ServiceState): void {
  state.epoch += 1;
  state.handles.clear();
}

async function handleSelect(state: ServiceState, windowId: string, message: Record<string, unknown>, send: Send): Promise<void> {
  const id = message.id as string;
  const requirements = message.requirements;
  if (!isLlmRequirements(requirements)) { reply(send, 'llm.select', id, { error: { code: 'invalid-request', message: 'requirements must be a Requirements record.' } }); return; }
  const wanted = requirements ?? {};
  const startEpoch = state.epoch;
  try {
    const connection = await state.host.select({ windowId }, wanted);
    if (state.closed) return;
    if (connection === null) { reply(send, 'llm.select', id, { error: { code: 'user-cancelled', message: 'The user declined to select a model connection.' } }); return; }
    if (!meetsRequirements(connection, wanted)) {
      reply(send, 'llm.select', id, { error: { code: 'unsupported', message: 'No connection meets the requested model or capabilities.' } });
      return;
    }
    if (startEpoch !== state.epoch) { reply(send, 'llm.select', id, { error: { code: 'selection-expired', message: 'Connections changed during selection; select again.' } }); return; }
    const handle = state.createHandle();
    windowHandles(state, windowId).set(handle, { connectionId: connection.id, snapshot: connection });
    reply(send, 'llm.select', id, { model: toModel(handle, connection) });
  } catch (error) {
    if (!state.closed) reply(send, 'llm.select', id, { error: failure(error) });
  }
}

async function revalidate(state: ServiceState, windowId: string, handle: unknown): Promise<LlmModel | LlmFailure> {
  if (!isNonemptyText(handle)) return { code: 'invalid-request', message: 'handle must be non-empty text.' };
  const entry = windowHandles(state, windowId).get(handle);
  if (!entry) return EXPIRED;
  const current = await state.host.describe({ windowId }, entry.connectionId);
  if (!current || !sameConnection(current, entry.snapshot)) {
    windowHandles(state, windowId).delete(handle);
    return EXPIRED;
  }
  return toModel(handle, current);
}

async function handleDescribe(state: ServiceState, windowId: string, message: Record<string, unknown>, send: Send): Promise<void> {
  const id = message.id as string;
  try {
    const outcome = await revalidate(state, windowId, message.handle);
    if (state.closed) return;
    if ('handle' in outcome) reply(send, 'llm.describe', id, { model: outcome });
    else reply(send, 'llm.describe', id, { error: outcome });
  } catch (error) {
    if (!state.closed) reply(send, 'llm.describe', id, { error: failure(error) });
  }
}

function admitGeneration(state: ServiceState, windowId: string, message: Record<string, unknown>): LlmFailure | null {
  const perWindow = state.active.get(windowId);
  if (perWindow?.has(message.id as string)) return { code: 'invalid-request', message: 'A generation with this id is already active.' };
  if (!isLlmGenerationRequest(message.request)) return { code: 'invalid-request', message: 'request must be a GenerationRequest record.' };
  if ((perWindow?.size ?? 0) >= state.maxConcurrent) return { code: 'quota-exceeded', message: 'Too many active generations for this napplet.' };
  if (JSON.stringify(message.request).length > state.maxRequestChars) return { code: 'quota-exceeded', message: 'The request exceeds the runtime size limit.' };
  return null;
}

function unsupportedInput(connection: LlmConnection, request: LlmGenerationRequest): LlmFailure | null {
  if (countLlmImages(request.messages) > 0 && !connection.images) return { code: 'unsupported', message: 'This connection does not accept image input.' };
  if (request.format === 'json' && !connection.json) return { code: 'unsupported', message: 'This connection does not support JSON-object output.' };
  return null;
}

function validateGeneration(generation: ActiveGeneration, result: unknown): LlmGeneration | LlmFailure {
  if (!isLlmGeneration(result)) return { code: 'provider-error', message: 'The provider returned an incomplete or malformed completion.' };
  if (generation.format === 'json' && result.finish === 'stop' && !isJsonObjectText(result.text)) {
    return { code: 'provider-error', message: 'The provider completed without a JSON object.' };
  }
  return result;
}

async function runGeneration(state: ServiceState, windowId: string, requestId: string, request: LlmGenerationRequest, generation: ActiveGeneration, send: Send): Promise<void> {
  const context = { windowId };
  const fail = (error: LlmFailure): void => failGeneration(state, windowId, requestId, generation, error);
  try {
    const outcome = await revalidate(state, windowId, request.handle);
    if (generation.settled) return;
    const entry = 'handle' in outcome ? windowHandles(state, windowId).get(request.handle) : undefined;
    if (!('handle' in outcome) || !entry) { fail('handle' in outcome ? EXPIRED : outcome); return; }
    const rejected = unsupportedInput(entry.snapshot, request);
    if (rejected) { fail(rejected); return; }
    const authorized = await state.host.authorize(context, entry.snapshot, request);
    if (generation.settled) return;
    if (!authorized) { fail({ code: 'user-cancelled', message: 'The user declined to disclose this request.' }); return; }
    if (generation.epoch !== state.epoch || !windowHandles(state, windowId).has(request.handle)) {
      fail({ code: 'selection-expired', message: 'The selected connection changed before submission; select again.' });
      return;
    }
    const result = await state.host.generate(context, entry.snapshot, request, {
      signal: generation.controller.signal,
      onDelta: (text) => {
        if (generation.settled || typeof text !== 'string') return;
        send({ type: 'llm.delta', requestId, sequence: generation.sequence++, text } as NappletMessage);
      },
    });
    if (generation.settled) return;
    const checked = validateGeneration(generation, result);
    if ('code' in checked) fail(checked);
    else settle(state, windowId, requestId, generation, { type: 'llm.generate.result', id: requestId, result: checked } as NappletMessage);
  } catch (error) {
    if (!generation.settled) fail(failure(error));
  }
}

function handleGenerate(state: ServiceState, windowId: string, message: Record<string, unknown>, send: Send): void {
  const requestId = message.id as string;
  const rejected = admitGeneration(state, windowId, message);
  if (rejected) { reply(send, 'llm.generate', requestId, { error: rejected }); return; }
  const request = message.request as LlmGenerationRequest;
  const generation: ActiveGeneration = {
    controller: new AbortController(), send, format: request.format ?? 'text', epoch: state.epoch, sequence: 0, settled: false, timer: undefined,
  };
  let perWindow = state.active.get(windowId);
  if (!perWindow) { perWindow = new Map(); state.active.set(windowId, perWindow); }
  perWindow.set(requestId, generation);
  generation.timer = setTimeout(() => failGeneration(state, windowId, requestId, generation, TIMEOUT), state.deadlineMs);
  void runGeneration(state, windowId, requestId, request, generation, send);
}

function handleCancel(state: ServiceState, windowId: string, message: Record<string, unknown>, send: Send): void {
  const id = message.id as string;
  if (!isNonemptyText(message.requestId)) { reply(send, 'llm.cancel', id, { error: { code: 'invalid-request', message: 'requestId must be non-empty text.' } }); return; }
  const generation = state.active.get(windowId)?.get(message.requestId);
  if (!generation || generation.settled) { reply(send, 'llm.cancel', id, { cancelled: false }); return; }
  failGeneration(state, windowId, message.requestId, generation, CANCELLED);
  reply(send, 'llm.cancel', id, { cancelled: true });
}

/**
 * Create the NAP-LLM service handler.
 *
 * @param options - Host adapter and policy limits.
 * @returns Service handler for `runtime.registerService('llm', handler)`.
 * @example
 * ```ts
 * const llm = createLlmService({ host });
 * runtime.registerService('llm', llm);
 * ```
 */
export function createLlmService(options: LlmServiceOptions): LlmService {
  if (!options || typeof options.host !== 'object' || options.host === null) {
    throw new Error('createLlmService: options.host is required');
  }
  const state: ServiceState = {
    host: options.host,
    deadlineMs: options.deadlineMs ?? 120_000,
    maxConcurrent: options.maxConcurrentPerWindow ?? 4,
    maxRequestChars: options.maxRequestChars ?? 4 * 1024 * 1024,
    createHandle: options.createHandle ?? defaultHandleFactory(),
    handles: new Map(),
    active: new Map(),
    epoch: 0,
    closed: false,
  };
  let unsubscribe: (() => void) | undefined;

  function revokeWindow(windowId: string): void {
    cancelWindow(state, windowId, CANCELLED);
    state.handles.delete(windowId);
  }

  return {
    descriptor: DESCRIPTOR,
    invalidateHandles: () => invalidateHandles(state),
    revokeWindow,
    activeGenerations: () => [...state.active.values()].reduce((total, perWindow) => total + perWindow.size, 0),
    onRegistered() {
      state.closed = false;
      unsubscribe?.();
      unsubscribe = state.host.subscribe?.(() => {
        invalidateHandles(state);
        for (const windowId of state.active.keys()) cancelWindow(state, windowId, CANCELLED);
      });
    },
    onUnregistered() {
      state.closed = true;
      unsubscribe?.(); unsubscribe = undefined;
      for (const windowId of state.active.keys()) cancelWindow(state, windowId, null);
      state.handles.clear();
    },
    handleMessage(windowId, message, send) {
      if (state.closed || !message || typeof message !== 'object' || Array.isArray(message) || !REQUEST_TYPES.has(message.type)) return;
      const envelope = message as NappletMessage & Record<string, unknown>;
      if (!isNonemptyText(envelope.id)) return;
      switch (message.type) {
        case 'llm.select': void handleSelect(state, windowId, envelope, send); return;
        case 'llm.describe': void handleDescribe(state, windowId, envelope, send); return;
        case 'llm.generate': handleGenerate(state, windowId, envelope, send); return;
        default: handleCancel(state, windowId, envelope, send);
      }
    },
    onWindowDestroyed(windowId) {
      cancelWindow(state, windowId, null);
      state.handles.delete(windowId);
    },
    onCapabilityRevoked(windowId, capability) {
      if (capability === null || capability === 'llm:generate') revokeWindow(windowId);
    },
  };
}
