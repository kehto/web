/**
 * core/types.ts — Shared contracts for every `@kehto/mocks` mock service.
 *
 * Mocks are plain `ServiceHandler`s with one extra `mock` control surface so
 * a shell can seed, inspect, and reset them from tests or devtools.
 */
import type { ServiceHandler, ServiceRuntimeContext, NappletMessage } from '@kehto/runtime';
import type { Capability } from '@kehto/acl/capabilities';

/**
 * Millisecond clock a mock reads instead of `Date.now()`.
 *
 * @example
 * ```ts
 * const clock: MockClock = { now: () => 1_700_000_000_000 };
 * ```
 */
export interface MockClock {
  /** Current wall time in milliseconds since the Unix epoch. */
  now(): number;
}

/**
 * Timer abstraction a mock uses for deferred pushes (progress, deltas, pads).
 * Returns a cancel function. Defaults to `setTimeout` when not supplied.
 *
 * @example
 * ```ts
 * const immediate: MockScheduler = { schedule: (_ms, fn) => { fn(); return () => {}; } };
 * ```
 */
export interface MockScheduler {
  /**
   * Run `fn` after `delayMs`.
   *
   * @param delayMs - Delay in milliseconds.
   * @param fn - Callback to run.
   * @returns A function that cancels the pending callback.
   */
  schedule(delayMs: number, fn: () => void): () => void;
}

/**
 * Options every mock factory accepts. Domain factories extend this.
 *
 * @example
 * ```ts
 * const options: MockServiceOptions = { seed: 7, clock: { now: () => 0 } };
 * ```
 */
export interface MockServiceOptions {
  /** Seed for deterministic ids and fixture ordering. Default `1`. */
  seed?: number;
  /** Clock used for timestamps. Default: `Date.now`. */
  clock?: MockClock;
  /** Scheduler used for deferred pushes. Default: `setTimeout`. */
  scheduler?: MockScheduler;
  /**
   * Artificial latency (ms) applied before each result. Default `0`, which
   * responds synchronously inside `handleMessage`.
   */
  latencyMs?: number;
}

/**
 * Control surface attached to every mock as `service.mock`.
 *
 * @example
 * ```ts
 * const service = createMockLinkService();
 * service.mock.reset();
 * console.log(service.mock.state());
 * ```
 */
export interface MockControls<TState> {
  /** Current in-memory state snapshot (live object; treat as read-only). */
  state(): TState;
  /** Restore the mock to its initial seeded state. */
  reset(): void;
  /** Exact message types this mock answers, in declaration order. */
  readonly routes: readonly string[];
  /** Every envelope this mock has sent, oldest first (cleared by `reset`). */
  readonly sent: readonly MockSentEnvelope[];
  /** Runtime context captured by `onRegistered`, when attached. */
  readonly runtime: ServiceRuntimeContext | undefined;
}

/**
 * One envelope a mock delivered, with its recipient window.
 *
 * @example
 * ```ts
 * const entry: MockSentEnvelope = { windowId: 'win-1', message: { type: 'link.open.result' } };
 * ```
 */
export interface MockSentEnvelope {
  /** Recipient napplet window. */
  windowId: string;
  /** Delivered NIP-5D envelope. */
  message: NappletMessage;
}

/**
 * A mock service: a `ServiceHandler` plus its `mock` controls.
 *
 * @example
 * ```ts
 * function use(service: MockService<{ opened: number }>): void {
 *   runtime.registerService(service.descriptor.name, service);
 *   service.mock.reset();
 * }
 * ```
 */
export interface MockService<TState = unknown> extends ServiceHandler {
  /** Inspection and reset controls. */
  readonly mock: MockControls<TState>;
}

/**
 * Where a NAP document was read from when the mock was written.
 *
 * @example
 * ```ts
 * const ref: NapSpecRef = {
 *   nap: 'NAP-LINK',
 *   status: 'draft',
 *   source: 'pr',
 *   pr: 53,
 *   sha: '50a2cd45e76f',
 *   path: 'naps/NAP-LINK.md',
 * };
 * ```
 */
export interface NapSpecRef {
  /** Document name, e.g. `NAP-RELAY`. */
  nap: string;
  /** `merged` on master, `draft` in an open PR, `exploratory` for sub-track or projection docs. */
  status: 'merged' | 'draft' | 'exploratory';
  /** `master` for merged docs, `pr` for pull-request heads. */
  source: 'master' | 'pr';
  /** Pull request number when `source` is `pr`. */
  pr?: number;
  /** Abbreviated (8+ hex) commit sha of the checked head. */
  sha: string;
  /** Repository path of the document. */
  path: string;
}

/**
 * How a NAP domain reaches a kehto host.
 *
 * - `service`: a built-in runtime domain routed to `serviceRegistry[domain]`.
 * - `extension`: a draft domain outside the built-in dispatcher; routed only
 *   when the handler declares `messageCapabilities` and the shell exposes the
 *   domain.
 * - `adapter`: runtime-owned domain backed by a `RuntimeAdapter` hook (storage).
 * - `runtime-owned`: handled entirely inside the runtime or shell (inc, shell).
 * - `posture`: a policy document with no wire messages (class sub-track).
 */
export type MockDomainKind = 'service' | 'extension' | 'adapter' | 'runtime-owned' | 'posture';

/**
 * One row of the mock registry.
 *
 * @example
 * ```ts
 * const entry: MockDomainEntry = {
 *   domain: 'link',
 *   kind: 'service',
 *   spec: LINK_SPEC_REF,
 *   create: (options) => createMockLinkService(options),
 * };
 * ```
 */
export interface MockDomainEntry {
  /** Wire domain (`message.type` prefix), or the NAP slug for non-wire docs. */
  domain: string;
  /** Routing kind. */
  kind: MockDomainKind;
  /** Spec document checked when the mock was written. */
  spec: NapSpecRef;
  /** Factory for `service`/`extension` kinds. Absent for other kinds. */
  create?: (options: MockServiceOptions) => MockService;
  /** Short note for kinds without a service factory. */
  note?: string;
}

/** Map of exact message type → required ACL capability (or `null`). */
export type MockCapabilityMap = Readonly<Record<string, Capability | null>>;
