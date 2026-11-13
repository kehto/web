/**
 * domains/llm.ts — Mock NAP-LLM service.
 *
 * Spec: naps/NAP-LLM.md @ napplet/naps PR #134 head 3e10939cf788 (draft) —
 *       base contract (select/describe/generate/cancel, deltas, errors);
 *       naps/NAP-LLM.md @ napplet/naps PR #138 head 8f741326c111 (draft) —
 *       tools, `maxTokens`/`temperature`/`samplingParams`, `thinking` and
 *       `toolCall` parts, `toolResult` role, block-aware deltas.
 * Routes: llm.select, llm.describe, llm.generate, llm.cancel
 * Pushes: llm.delta, llm.generate.result (terminal, after streaming)
 * Spec gaps / decisions:
 * - pr134 `Generation.text` and pr138 `Generation.content` disagree on the
 *   result shape; the mock emits both (`text` is the flat text, `content` the
 *   part list) so a napplet written against either draft reads its field.
 * - Deltas carry pr138 `block`/`blockIndex` in addition to pr134 `text`; a
 *   pr134 consumer ignores the extra fields.
 * - Disclosure consent is auto-granted: the mock has no UI. `user-cancelled`
 *   is never produced; a shell adds its own consent gate.
 * - No generation deadline is modelled; `timeout` is never produced.
 * - `samplingParams` are accepted and dropped, as pr138 requires.
 */
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_SCHEDULER, defineMockService, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockScheduler, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import {
  MOCK_LLM_CONNECTIONS,
  deriveAnswer,
  estimateTokens,
  meetsRequirements,
  requestInputText,
  splitDeltas,
  unsupportedInput,
  validateGenerationRequest,
  validateRequirements,
  type MockLlmAnswer,
  type MockLlmConnection,
  type MockLlmFailure,
  type MockLlmFinish,
  type MockLlmGenerationRequest,
  type MockLlmRequirements,
} from './llm-fixtures.js';

export type {
  MockLlmAnswer,
  MockLlmConnection,
  MockLlmFailure,
  MockLlmFinish,
  MockLlmGenerationRequest,
  MockLlmMessage,
  MockLlmPart,
  MockLlmRequirements,
  MockLlmTool,
  MockLlmToolChoice,
} from './llm-fixtures.js';
export {
  MOCK_LLM_ANSWER_SUFFIX,
  MOCK_LLM_CONNECTIONS,
  deriveAnswer,
  estimateTokens,
  meetsRequirements,
  requestInputText,
  splitDeltas,
  unsupportedInput,
  validateGenerationRequest,
  validateRequirements,
} from './llm-fixtures.js';

/**
 * Base NAP-LLM draft the mock implements.
 *
 * @example
 * ```ts
 * LLM_SPEC_REF.pr === 134;
 * ```
 */
export const LLM_SPEC_REF: NapSpecRef = {
  nap: 'NAP-LLM',
  status: 'draft',
  source: 'pr',
  pr: 134,
  sha: '3e10939cf788',
  path: 'naps/NAP-LLM.md',
};

/**
 * Tool-use / inference-control extension of NAP-LLM also honored by the mock.
 *
 * @example
 * ```ts
 * LLM_TOOLS_SPEC_REF.pr === 138;
 * ```
 */
export const LLM_TOOLS_SPEC_REF: NapSpecRef = {
  nap: 'NAP-LLM',
  status: 'draft',
  source: 'pr',
  pr: 138,
  sha: '8f741326c111',
  path: 'naps/NAP-LLM.md',
};

/**
 * A live model handle issued to one window.
 *
 * @example
 * ```ts
 * const entry: MockLlmHandle = { handle: 'h-0123456789ab', connectionId: 'local-llama', epoch: 0 };
 * ```
 */
export interface MockLlmHandle {
  /** Opaque wire handle. */
  handle: string;
  /** Seeded connection id. */
  connectionId: string;
  /** Handle epoch; handles from an older epoch are expired. */
  epoch: number;
}

/**
 * One in-flight generation.
 *
 * @example
 * ```ts
 * const active = service.mock.state().active.get('win-1')?.get('g1');
 * active?.sequence; // deltas sent so far
 * ```
 */
export interface MockLlmActiveGeneration {
  /** Request id. */
  requestId: string;
  /** Owning window. */
  windowId: string;
  /** Handle used. */
  handle: string;
  /** Next delta sequence number. */
  sequence: number;
  /** Whether a terminal result was sent. */
  settled: boolean;
  /** Cancel the pending scheduler step. */
  cancel: () => void;
  /** Deliver an envelope to the owning window. */
  push: (message: NappletMessage) => void;
}

/**
 * A scripted answer queued by `respondWith`.
 *
 * @example
 * ```ts
 * const next: MockLlmScriptedAnswer = { text: 'Scripted', finish: 'stop' };
 * ```
 */
export interface MockLlmScriptedAnswer {
  /** Text to stream. */
  text: string;
  /** Finish reason. */
  finish: MockLlmFinish;
}

/**
 * In-memory state of the mock LLM service.
 *
 * @example
 * ```ts
 * const state = service.mock.state();
 * state.generations; // provider generations started so far
 * ```
 */
export interface MockLlmState {
  /** Seeded connections. */
  connections: MockLlmConnection[];
  /** Window → handle → entry. */
  handles: Map<string, Map<string, MockLlmHandle>>;
  /** Window → request id → generation. */
  active: Map<string, Map<string, MockLlmActiveGeneration>>;
  /** Scripted answers consumed in order by the next generations. */
  scripted: MockLlmScriptedAnswer[];
  /** Current handle epoch. */
  epoch: number;
  /** Generations started (would-be provider calls). */
  generations: number;
}

/**
 * Options for `createMockLlmService`.
 *
 * @example
 * ```ts
 * const service = createMockLlmService({ tickMs: 0, wordsPerDelta: 2 });
 * ```
 */
export interface MockLlmOptions extends MockServiceOptions {
  /** Override the seeded connections. */
  connections?: readonly MockLlmConnection[];
  /** Delay between streamed deltas in ms (scheduler ticks). Default 10. */
  tickMs?: number;
  /** Words per delta. Default 3. */
  wordsPerDelta?: number;
  /** Active generations allowed per window. Default 4. */
  maxConcurrentPerWindow?: number;
}

/**
 * Mock LLM service with scripting controls.
 *
 * @example
 * ```ts
 * const llm = createMockLlmService();
 * llm.respondWith('Scripted answer');
 * ```
 */
export type MockLlmService = MockService<MockLlmState> & {
  /** Queue the text the next generation streams (with `finish`, default `stop`). */
  respondWith(text: string, finish?: MockLlmFinish): void;
  /** Expire every handle and cancel active work (account/connection change). */
  invalidateHandles(): void;
};

const CANCELLED: MockLlmFailure = { code: 'cancelled', message: 'Generation cancelled; provider charges may still apply.' };
const EXPIRED: MockLlmFailure = { code: 'selection-expired', message: 'Unknown or expired model handle; select again.' };

type Context = MockRouteContext<MockLlmState>;

function requestId(message: Record<string, unknown>): string | undefined {
  return typeof message.id === 'string' && message.id.length > 0 ? message.id : undefined;
}

function failWith(push: (msg: NappletMessage) => void, type: string, id: string, error: MockLlmFailure): void {
  push({ type: `${type}.result`, id, error } as NappletMessage);
}

function toModel(handle: string, connection: MockLlmConnection): Record<string, unknown> {
  return {
    handle,
    name: connection.name,
    model: connection.model,
    route: connection.route,
    images: connection.images,
    json: connection.json,
    tools: connection.tools,
  };
}

function liveConnection(state: MockLlmState, windowId: string, handle: unknown): MockLlmConnection | undefined {
  if (typeof handle !== 'string') return undefined;
  const entry = state.handles.get(windowId)?.get(handle);
  if (!entry || entry.epoch !== state.epoch) return undefined;
  return state.connections.find((item) => item.id === entry.connectionId);
}

function settle(state: MockLlmState, generation: MockLlmActiveGeneration, terminal: NappletMessage | null): void {
  if (generation.settled) return;
  generation.settled = true;
  generation.cancel();
  const perWindow = state.active.get(generation.windowId);
  perWindow?.delete(generation.requestId);
  if (perWindow?.size === 0) state.active.delete(generation.windowId);
  if (terminal) generation.push(terminal);
}

function failGeneration(state: MockLlmState, generation: MockLlmActiveGeneration, error: MockLlmFailure): void {
  settle(state, generation, { type: 'llm.generate.result', id: generation.requestId, error } as NappletMessage);
}

function cancelWindow(state: MockLlmState, windowId: string, error: MockLlmFailure | null): void {
  for (const generation of Array.from(state.active.get(windowId)?.values() ?? [])) {
    if (error) failGeneration(state, generation, error);
    else settle(state, generation, null);
  }
}

function selectRoute({ message, windowId, state, reply, push, rng }: Context): void {
  const id = requestId(message);
  if (!id) return;
  const invalid = validateRequirements(message.requirements);
  if (invalid) { failWith(push, 'llm.select', id, invalid); return; }
  const wanted = (message.requirements ?? {}) as MockLlmRequirements;
  const connection = state.connections.find((item) => meetsRequirements(item, wanted));
  if (!connection) {
    failWith(push, 'llm.select', id, { code: 'unsupported', message: 'No connection meets the requested model or capabilities.' });
    return;
  }
  const handle = `h-${rng.hex(12)}`;
  let perWindow = state.handles.get(windowId);
  if (!perWindow) { perWindow = new Map(); state.handles.set(windowId, perWindow); }
  perWindow.set(handle, { handle, connectionId: connection.id, epoch: state.epoch });
  reply({ model: toModel(handle, connection) });
}

function describeRoute({ message, windowId, state, reply, push }: Context): void {
  const id = requestId(message);
  if (!id) return;
  if (typeof message.handle !== 'string' || message.handle.length === 0) {
    failWith(push, 'llm.describe', id, { code: 'invalid-request', message: 'handle must be non-empty text.' });
    return;
  }
  const connection = liveConnection(state, windowId, message.handle);
  if (!connection) { failWith(push, 'llm.describe', id, EXPIRED); return; }
  reply({ model: toModel(message.handle, connection) });
}

function cancelRoute({ message, windowId, state, reply, push }: Context): void {
  const id = requestId(message);
  if (!id) return;
  if (typeof message.requestId !== 'string' || message.requestId.length === 0) {
    failWith(push, 'llm.cancel', id, { code: 'invalid-request', message: 'requestId must be non-empty text.' });
    return;
  }
  const generation = state.active.get(windowId)?.get(message.requestId);
  if (!generation || generation.settled) { reply({ cancelled: false }); return; }
  failGeneration(state, generation, CANCELLED);
  reply({ cancelled: true });
}

interface StreamPlan {
  /** Delta chunks in order. */
  chunks: string[];
  /** pr138 block kind. */
  block: 'text' | 'toolcall';
  /** Terminal result payload. */
  result: Record<string, unknown>;
}

function planStream(answer: MockLlmAnswer, request: MockLlmGenerationRequest, wordsPerDelta: number): StreamPlan {
  const toolCall = answer.parts.find((item) => item.type === 'toolCall');
  const streamed = toolCall ? JSON.stringify(toolCall.arguments ?? {}) : answer.text;
  const usage = { inputTokens: estimateTokens(requestInputText(request)), outputTokens: estimateTokens(streamed) };
  return {
    chunks: splitDeltas(streamed, wordsPerDelta),
    block: toolCall ? 'toolcall' : 'text',
    result: { text: answer.text, content: answer.parts, finish: answer.finish, usage },
  };
}

function admit(context: Context, id: string, max: number): MockLlmFailure | null {
  const { message, windowId, state } = context;
  const perWindow = state.active.get(windowId);
  if (perWindow?.has(id)) return { code: 'invalid-request', message: 'A generation with this id is already active.' };
  const invalid = validateGenerationRequest(message.request);
  if (invalid) return invalid;
  if ((perWindow?.size ?? 0) >= max) return { code: 'quota-exceeded', message: 'Too many active generations for this napplet.' };
  const request = message.request as MockLlmGenerationRequest;
  const connection = liveConnection(state, windowId, request.handle);
  if (!connection) return EXPIRED;
  return unsupportedInput(connection, request);
}

/**
 * Create the mock NAP-LLM service.
 *
 * @param options - Seeds, streaming cadence and limits.
 * @returns A `ServiceHandler` for `runtime.registerService('llm', …)` with mock controls.
 * @example
 * ```ts
 * const llm = createMockLlmService({ seed: 3 });
 * llm.handleMessage('win-1', { type: 'llm.select', id: 's1' }, console.log);
 * ```
 */
export function createMockLlmService(options: MockLlmOptions = {}): MockLlmService {
  const scheduler: MockScheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const tickMs = options.tickMs ?? 10;
  const wordsPerDelta = options.wordsPerDelta ?? 3;
  const maxConcurrent = options.maxConcurrentPerWindow ?? 4;
  const seeds = options.connections ?? MOCK_LLM_CONNECTIONS;

  const stream = (state: MockLlmState, generation: MockLlmActiveGeneration, plan: StreamPlan): void => {
    const step = (index: number): void => {
      if (generation.settled) return;
      if (index >= plan.chunks.length) {
        settle(state, generation, { type: 'llm.generate.result', id: generation.requestId, result: plan.result } as NappletMessage);
        return;
      }
      generation.push({
        type: 'llm.delta',
        requestId: generation.requestId,
        sequence: generation.sequence,
        block: plan.block,
        blockIndex: 0,
        text: plan.chunks[index],
      } as NappletMessage);
      generation.sequence += 1;
      generation.cancel = scheduler.schedule(tickMs, () => step(index + 1));
    };
    generation.cancel = scheduler.schedule(tickMs, () => step(0));
  };

  const generateRoute = (context: Context): void => {
    const { message, windowId, state, push, rng } = context;
    const id = requestId(message);
    if (!id) return;
    const rejected = admit(context, id, maxConcurrent);
    if (rejected) { failWith(push, 'llm.generate', id, rejected); return; }
    const request = message.request as MockLlmGenerationRequest;
    const scripted = state.scripted.shift();
    const answer: MockLlmAnswer = scripted
      ? { text: scripted.text, parts: [{ type: 'text', text: scripted.text }], finish: scripted.finish }
      : deriveAnswer(request, `call_${rng.hex(8)}`);
    state.generations += 1;
    const generation: MockLlmActiveGeneration = {
      requestId: id, windowId, handle: request.handle, sequence: 0, settled: false, cancel: () => {}, push,
    };
    let perWindow = state.active.get(windowId);
    if (!perWindow) { perWindow = new Map(); state.active.set(windowId, perWindow); }
    perWindow.set(id, generation);
    stream(state, generation, planStream(answer, request, wordsPerDelta));
  };

  const base = defineMockService<MockLlmState>({
    domain: 'llm',
    version: '1.0.0',
    description: 'Mock NAP-LLM: two seeded connections, deterministic streamed answers',
    kind: 'service',
    initialState: () => ({
      connections: seeds.map((item) => ({ ...item })),
      handles: new Map(),
      active: new Map(),
      scripted: [],
      epoch: 0,
      generations: 0,
    }),
    routes: {
      'llm.select': selectRoute,
      'llm.describe': describeRoute,
      'llm.generate': generateRoute,
      'llm.cancel': cancelRoute,
    },
    onWindowDestroyed: (windowId, state) => {
      cancelWindow(state, windowId, null);
      state.handles.delete(windowId);
    },
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability !== null && capability !== 'llm:generate') return;
      cancelWindow(state, windowId, CANCELLED);
      state.handles.delete(windowId);
    },
  }, options);

  const baseReset = base.mock.reset;
  base.mock.reset = () => {
    const state = base.mock.state();
    for (const windowId of Array.from(state.active.keys())) cancelWindow(state, windowId, null);
    baseReset();
  };

  const service: MockLlmService = Object.assign(base, {
    respondWith(text: string, finish: MockLlmFinish = 'stop'): void {
      base.mock.state().scripted.push({ text, finish });
    },
    invalidateHandles(): void {
      const state = base.mock.state();
      state.epoch += 1;
      state.handles.clear();
      for (const windowId of Array.from(state.active.keys())) cancelWindow(state, windowId, CANCELLED);
    },
  });
  return service;
}

/**
 * Registry row for the `llm` domain.
 *
 * @example
 * ```ts
 * LLM_MOCK_ENTRY.create?.({ seed: 1 }).descriptor.name === 'llm';
 * ```
 */
export const LLM_MOCK_ENTRY: MockDomainEntry = {
  domain: 'llm',
  kind: 'service',
  spec: LLM_SPEC_REF,
  create: (options) => createMockLlmService(options),
};
