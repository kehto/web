/**
 * domains/class.ts — Mock NAP-CLASS track: class authority plus the two
 * posture documents.
 *
 * Spec: naps/NAP-CLASS.md   @ napplet/naps PR #16 head 4828279800dc (draft)
 *       naps/NAP-CLASS-1.md @ napplet/naps PR #17 head b9128e0cb611 (draft)
 *       naps/NAP-CLASS-2.md @ napplet/naps PR #18 head 45c9b12dcb87 (draft)
 * Routes: none (napplet → shell). NAP-CLASS defines one shell → napplet push,
 *         `class.assigned` (`id`, `class`), so `class` is an `extension` mock
 *         with an `assign()` control rather than a `posture` row. NAP-CLASS-1
 *         and NAP-CLASS-2 define no wire messages and stay `posture`.
 * Spec gaps / decisions:
 * - `class.assigned` is at-most-one per napplet lifecycle; `assign()` refuses
 *   a second call for a window until `onWindowDestroyed` starts a new one.
 * - The envelope must precede other shell-originated envelopes; a mock cannot
 *   order frame bootstrap, so the shell must call `assign()` first thing after
 *   iframe readiness. The CSP/consent posture itself is shell-enforced at
 *   frame creation and is not simulated here.
 * - `assign()` pushes through `pushToWindow`, which needs the runtime context
 *   (`onRegistered`) since no request ever reaches this handler. The handler
 *   declares `class.assigned` in `pushCapabilities` with no ACL capability:
 *   NAP-CLASS gates delivery on the shell advertising `nap:class`, which the
 *   runtime models as the registered `class` service plus an explicit
 *   `isDomainAllowed` grant for the recipient window. A refused push (window
 *   not live, domain not exposed) makes `assign()` return `false` and leaves
 *   no assignment recorded, so the lifecycle's single envelope is still owed.
 * - The class integer defaults to `1` (NAP-CLASS-1 is the default posture);
 *   `classFor(windowId)` lets a host simulate NAP-CLASS-2 grants or denials.
 */
import type { NappletMessage } from '@kehto/runtime';

import { defineMockService, inheritMockPush, pushToWindow } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/**
 * NAP-CLASS document checked when this mock was written.
 *
 * @example
 * ```ts
 * CLASS_SPEC_REF.pr === 16;
 * ```
 */
export const CLASS_SPEC_REF: NapSpecRef = {
  nap: 'NAP-CLASS',
  status: 'draft',
  source: 'pr',
  pr: 16,
  sha: '4828279800dc',
  path: 'naps/NAP-CLASS.md',
};

/**
 * NAP-CLASS-1 document checked when this entry was written.
 *
 * @example
 * ```ts
 * CLASS_1_SPEC_REF.pr === 17;
 * ```
 */
export const CLASS_1_SPEC_REF: NapSpecRef = {
  nap: 'NAP-CLASS-1',
  status: 'draft',
  source: 'pr',
  pr: 17,
  sha: 'b9128e0cb611',
  path: 'naps/NAP-CLASS-1.md',
};

/**
 * NAP-CLASS-2 document checked when this entry was written.
 *
 * @example
 * ```ts
 * CLASS_2_SPEC_REF.pr === 18;
 * ```
 */
export const CLASS_2_SPEC_REF: NapSpecRef = {
  nap: 'NAP-CLASS-2',
  status: 'draft',
  source: 'pr',
  pr: 18,
  sha: '45c9b12dcb87',
  path: 'naps/NAP-CLASS-2.md',
};

/**
 * One posture from the `NAP-CLASS-$N` sub-track, as the documents define it.
 *
 * @example
 * ```ts
 * const strict: MockNappletClassPosture = MOCK_NAPPLET_CLASSES[1];
 * strict.connectSrc === "'none'";
 * ```
 */
export interface MockNappletClassPosture {
  /** Integer carried by `class.assigned`. */
  class: number;
  /** Track document file name. */
  document: string;
  /** Posture title from the document subtitle. */
  title: string;
  /** Exact `connect-src` directive shape the shell must emit. */
  connectSrc: string;
  /** Whether the shell prompts the user before serving. */
  consentPrompt: boolean;
  /** Grant persistence key components, or `null` when the posture keeps no grant state. */
  grantKey: readonly string[] | null;
  /** Whether residual `<meta http-equiv="Content-Security-Policy">` makes the shell refuse to serve. */
  refuseOnMetaCsp: boolean;
  /** Class served when the user denies the prompt, when a prompt exists. */
  deniedFallbackClass?: number;
}

/**
 * The two published postures keyed by class integer.
 *
 * @example
 * ```ts
 * MOCK_NAPPLET_CLASSES[2].deniedFallbackClass === 1;
 * ```
 */
export const MOCK_NAPPLET_CLASSES: Readonly<Record<1 | 2, MockNappletClassPosture>> = Object.freeze({
  1: Object.freeze({
    class: 1,
    document: 'NAP-CLASS-1.md',
    title: 'Strict Baseline Class',
    connectSrc: "'none'",
    consentPrompt: false,
    grantKey: null,
    refuseOnMetaCsp: false,
  }),
  2: Object.freeze({
    class: 2,
    document: 'NAP-CLASS-2.md',
    title: 'User-Approved Explicit-Origin Class',
    connectSrc: '<space-separated-list-of-granted-origins>',
    consentPrompt: true,
    grantKey: Object.freeze(['dTag', 'aggregateHash']),
    refuseOnMetaCsp: true,
    deniedFallbackClass: 1,
  }),
});

/**
 * One delivered `class.assigned` envelope.
 *
 * @example
 * ```ts
 * const assigned = service.mock.state().assigned.get('w1');
 * assigned?.class === 1;
 * ```
 */
export interface MockClassAssignment {
  /** Correlation id minted for the envelope. */
  id: string;
  /** Class integer delivered. */
  class: number;
}

/**
 * In-memory state of the class mock.
 *
 * @example
 * ```ts
 * service.mock.state().assigned.size;
 * ```
 */
export interface MockClassState {
  /** Windows that received `class.assigned` in their current lifecycle. */
  assigned: Map<string, MockClassAssignment>;
  /** Next correlation id counter. */
  nextId: number;
}

/**
 * Factory options for the class mock.
 *
 * @example
 * ```ts
 * const service = createMockClassService({ classFor: (windowId) => (windowId === 'w2' ? 2 : 1) });
 * ```
 */
export interface MockClassOptions extends MockServiceOptions {
  /** Class integer to assign when `assign()` gets no explicit value. Default `1`. */
  defaultClass?: number;
  /** Per-window class resolver, consulted before `defaultClass`. */
  classFor?: (windowId: string) => number | undefined;
}

/**
 * Class mock with the shell-side assignment control.
 *
 * @example
 * ```ts
 * const service = createMockClassService();
 * service.onRegistered?.(runtimeContext);
 * service.assign('w1', 2);
 * ```
 */
export type MockClassService = MockService<MockClassState> & {
  /**
   * Push `class.assigned` to a window once per lifecycle.
   *
   * @param windowId - Recipient window (must be registered with the runtime).
   * @param classNumber - Non-negative integer; defaults to `classFor`/`defaultClass`.
   * @returns `false` when the window already received its envelope, the value
   * is not a non-negative integer, or no delivery path exists.
   */
  assign(windowId: string, classNumber?: number): boolean;
};

const isClassNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * Create the NAP-CLASS mock.
 *
 * @param options - Default class, per-window resolver, and shared mock options.
 * @returns A `class` extension handler with `mock` and `assign`.
 * @example
 * ```ts
 * const service = createMockClassService({ defaultClass: 2 });
 * ```
 */
export function createMockClassService(options: MockClassOptions = {}): MockClassService {
  const mock = defineMockService<MockClassState>({
    domain: 'class',
    version: '1.0.0',
    description: 'Mock NAP-CLASS authority: pushes class.assigned once per napplet lifecycle',
    kind: 'extension',
    pushes: { 'class.assigned': null },
    initialState: () => ({ assigned: new Map(), nextId: 1 }),
    routes: {},
    onWindowDestroyed: (windowId, state) => { state.assigned.delete(windowId); },
  }, options);

  const service: MockClassService = {
    ...mock,
    assign(windowId, classNumber) {
      const state = mock.mock.state();
      const value = classNumber ?? options.classFor?.(windowId) ?? options.defaultClass ?? 1;
      if (state.assigned.has(windowId) || !isClassNumber(value)) return false;
      const id = `c${state.nextId}`;
      const delivered = pushToWindow(service, windowId, { type: 'class.assigned', id, class: value } as NappletMessage);
      if (!delivered) return false;
      state.nextId += 1;
      state.assigned.set(windowId, { id, class: value });
      return true;
    },
  };
  inheritMockPush(service, mock);
  return service;
}

/**
 * Registry row for the class authority mock (`extension`, push-only).
 *
 * @example
 * ```ts
 * CLASS_MOCK_ENTRY.create?.({});
 * ```
 */
export const CLASS_MOCK_ENTRY: MockDomainEntry = {
  domain: 'class',
  kind: 'extension',
  spec: CLASS_SPEC_REF,
  create: (o) => createMockClassService(o),
  note: 'Push-only: call service.assign(windowId, class) right after iframe readiness; '
    + 'the shell still enforces the CSP/consent posture itself at frame creation.',
};

/**
 * Registry row for NAP-CLASS-1 (posture, no wire messages).
 *
 * @example
 * ```ts
 * CLASS_1_MOCK_ENTRY.kind === 'posture';
 * ```
 */
export const CLASS_1_MOCK_ENTRY: MockDomainEntry = {
  domain: 'class-1',
  kind: 'posture',
  spec: CLASS_1_SPEC_REF,
  note: "Strict baseline: connect-src 'none', no consent prompt, no grant state; the default class "
    + 'when no class-contributing NAP triggers, delivered as class.assigned { class: 1 }.',
};

/**
 * Registry row for NAP-CLASS-2 (posture, no wire messages).
 *
 * @example
 * ```ts
 * CLASS_2_MOCK_ENTRY.kind === 'posture';
 * ```
 */
export const CLASS_2_MOCK_ENTRY: MockDomainEntry = {
  domain: 'class-2',
  kind: 'posture',
  spec: CLASS_2_SPEC_REF,
  note: 'User-approved explicit origins: connect-src limited to the granted origins after a first-load consent prompt '
    + 'keyed on (dTag, aggregateHash), refuse-to-serve on residual meta-CSP, denied napplets served as class 1.',
};
