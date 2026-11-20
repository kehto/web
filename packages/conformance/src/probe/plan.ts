/**
 * probe/plan.ts — The data language a reference probe executes.
 *
 * A probe is a napplet artifact whose bytes embed one {@link ProbePlan}. Plans
 * are data, not code, so the probe runs under the NIP-5D baseline CSP (no
 * `eval`) and its artifact hash is a pure function of the plan.
 */

/** Substituted with a recording function when a step runs. */
export interface CallbackArg { readonly $callback: string }
/** Substituted with a value a previous step stored under `as`. */
export interface HandleArg { readonly $handle: string }
/** A JSON argument, a recording callback, or a stored handle. */
export type PlanArg = unknown | CallbackArg | HandleArg;

/** Call a function under `window.napplet` (or `window` when `root` is `window`). */
export interface CallStep {
  readonly op: 'call';
  /** Record name; also the handle name when the call returns an object. */
  readonly as: string;
  /** Property path, e.g. `['shell', 'supports']`. */
  readonly path: readonly string[];
  readonly args?: readonly PlanArg[];
  readonly root?: 'napplet' | 'window';
  /** Do not wait for a returned promise; its final state is reported when the plan ends. */
  readonly background?: boolean;
  readonly timeoutMs?: number;
}

/** Call a method on a handle stored by an earlier step. */
export interface InvokeStep {
  readonly op: 'invoke';
  readonly as: string;
  readonly handle: string;
  readonly method: string;
  readonly args?: readonly PlanArg[];
  readonly timeoutMs?: number;
}

/** Read a property under `window.napplet` (or `window`). */
export interface ReadStep {
  readonly op: 'read';
  readonly as: string;
  readonly path: readonly string[];
  readonly root?: 'napplet' | 'window';
}

/** Post a raw message on the napplet's NAP port. Needs a probe loaded with `rawWire`. */
export interface SendStep {
  readonly op: 'send';
  /** Anything structured-cloneable: malformed-wire cases send arrays and scalars. */
  readonly envelope: unknown;
  /**
   * Envelope fields copied from values earlier steps recorded, e.g.
   * `{ target: { as: 'evB', path: ['sender'] } }`. A missing source leaves the field unset.
   */
  readonly fill?: Readonly<Record<string, { readonly as: string; readonly path: readonly string[] }>>;
}

/** Wait for an inbound port message whose fields equal `match`. Records `null` on timeout. */
export interface ExpectStep {
  readonly op: 'expect';
  readonly as: string;
  readonly match: Readonly<Record<string, unknown>>;
  readonly timeoutMs?: number;
  /** Only consider messages that arrived after this mark step ran. */
  readonly since?: string;
}

/** Record every inbound port message that arrives during a quiet window. */
export interface QuietStep {
  readonly op: 'quiet';
  readonly as: string;
  readonly ms?: number;
  /** Start the window at this mark instead of at the step itself. */
  readonly since?: string;
}

/** Tell the harness the probe reached a named point. */
export interface MarkStep { readonly op: 'mark'; readonly name: string }
/** Block until the harness signals `name`. Records whether the signal arrived. */
export interface WaitSignalStep { readonly op: 'waitSignal'; readonly as?: string; readonly name: string; readonly timeoutMs?: number }
/** Pause. */
export interface SleepStep { readonly op: 'sleep'; readonly ms: number }
/** Capture the realm snapshot again (namespace keys, `window.nostr`, reachable ports). */
export interface SnapshotStep { readonly op: 'snapshot'; readonly as: string }
/** Post a window-level message to the parent, optionally transferring a fresh port. */
export interface WindowPostStep { readonly op: 'windowPost'; readonly message: unknown; readonly withPort?: boolean }
/** Assign a JSON value to a property under `window.napplet`. Records `threw` when the assignment throws. */
export interface AssignStep { readonly op: 'assign'; readonly as: string; readonly path: readonly string[]; readonly value: unknown }

/** One instruction of a probe plan. */
export type ProbeStep =
  | CallStep | InvokeStep | ReadStep | SendStep | ExpectStep | QuietStep
  | MarkStep | WaitSignalStep | SleepStep | SnapshotStep | WindowPostStep | AssignStep;

/**
 * The instructions one probe executes after its document loads.
 *
 * @example
 * ```ts
 * const plan: ProbePlan = {
 *   label: 'theme-get',
 *   steps: [
 *     { op: 'send', envelope: { type: 'theme.get', id: 'c1' } },
 *     { op: 'expect', as: 'reply', match: { type: 'theme.get.result', id: 'c1' } },
 *   ],
 * };
 * ```
 */
export interface ProbePlan {
  /** Human label; part of the artifact bytes, so it also separates identities. */
  readonly label: string;
  readonly steps: readonly ProbeStep[];
  /** Default wait for `call`, `invoke`, `expect` and `waitSignal`. */
  readonly timeoutMs?: number;
  /** Default length of a `quiet` window. */
  readonly settleMs?: number;
}

/** What the probe saw in its own realm. */
export interface RealmSnapshot {
  /** `typeof window.napplet`. */
  readonly napplet: string;
  /** Own keys of `window.napplet`, sorted. */
  readonly domains: readonly string[];
  /** `typeof window.nostr`. */
  readonly nostr: string;
  /** `'nostr' in window`. */
  readonly nostrPresent: boolean;
  /** Globals that would hand a napplet signing or encryption authority. */
  readonly signingGlobals: readonly string[];
  /** `window.origin`; `null` for an opaque sandbox origin. */
  readonly origin: string;
  /** `location.href`; `about:srcdoc` for a srcdoc document. */
  readonly href: string;
  /** Whether `localStorage` was reachable. */
  readonly storage: 'blocked' | 'accessible';
  /** Paths at which a `MessagePort` is reachable from `window` or the namespace. */
  readonly reachablePorts: readonly string[];
}

/** State of a value a step produced. */
export type StepState = 'value' | 'resolved' | 'rejected' | 'pending' | 'threw' | 'missing' | 'timeout';

/** The record one step leaves behind. */
export interface StepRecord {
  readonly index: number;
  readonly op: ProbeStep['op'];
  readonly as?: string;
  readonly state: StepState;
  /** JSON-safe copy of the produced value, matched message, or quiet-window messages. */
  readonly value?: unknown;
  /** Error message for `rejected` and `threw`. */
  readonly error?: string;
  /** Milliseconds since the probe document started. */
  readonly at: number;
}

/**
 * Everything one probe reported.
 *
 * @example
 * ```ts
 * const reply = report.steps.find((step) => step.as === 'reply')?.value;
 * ```
 */
export interface ProbeReport {
  readonly label: string;
  /** Snapshot taken by the first authored classic script. */
  readonly classic: RealmSnapshot | null;
  /** Snapshot taken by the first authored module script. */
  readonly module: RealmSnapshot | null;
  readonly steps: readonly StepRecord[];
  /** Arguments of every recorded callback invocation, by callback name. */
  readonly callbacks: Readonly<Record<string, readonly unknown[][]>>;
  /** Marks reached, in order. */
  readonly marks: readonly string[];
  /** `true` when the plan ran to its end. */
  readonly completed: boolean;
}
