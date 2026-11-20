/**
 * fixtures/types.ts — The data a domain fixture gives the generic domain scenario.
 *
 * Fixtures are target-agnostic: they describe requests, expected replies and
 * host-triggered pushes. A target supplies the backends and the named host
 * controls the push cases call.
 */

/** Result of a semantic assertion: `null` when it holds, otherwise why it failed. */
export type SemanticVerdict = string | null;

/** A napplet -> runtime request and the reply it must get. */
export interface OperationCase {
  /** Stable case id, e.g. `theme/get`. */
  readonly id: string;
  /** Request type, e.g. `theme.get`. */
  readonly type: string;
  /** Payload fields besides `type` and `id`. */
  readonly payload?: Readonly<Record<string, unknown>>;
  /**
   * Expected reply type. Default `<type>.result`. `null` marks a
   * fire-and-forget operation: nothing correlated may come back.
   */
  readonly reply?: string | null;
  /** The request carries no `id` (fire-and-forget operations). */
  readonly noId?: boolean;
  /** A reply carrying `error` still passes (the case proves routing and correlation only). */
  readonly allowError?: boolean;
  /**
   * Payload fields copied from an earlier case's reply, e.g.
   * `{ notificationId: { case: 'notify/send', path: ['notificationId'] } }`.
   */
  readonly fill?: Readonly<Record<string, { readonly case: string; readonly path: readonly string[] }>>;
  /**
   * NAP semantics this case asserts beyond envelope shape. Present only when
   * the assertion is argued from a sentence of the pinned NAP revision.
   */
  readonly semantics?: {
    /** One-line statement of the asserted rule, quoting or paraphrasing the NAP. */
    readonly rule: string;
    verify(reply: Readonly<Record<string, unknown>> | null): SemanticVerdict;
  };
}

/** A host-triggered push, proven delivered and then proven stopped. */
export interface PushCase {
  readonly id: string;
  /** Push type, e.g. `theme.changed`. */
  readonly type: string;
  /** Request that starts delivery, when the domain needs one. */
  readonly subscribe?: OperationCase;
  /**
   * Host control that makes the runtime push, and its payload. Omit it for a
   * push the subscribe request itself causes (e.g. `relay.eose`).
   */
  readonly trigger?: { readonly control: string; readonly payload?: unknown };
  /** Fields the delivered push must carry (deep-equal). */
  readonly match?: Readonly<Record<string, unknown>>;
  /** Request that stops delivery. Without one the case proves delivery only. */
  readonly unsubscribe?: OperationCase;
  /** Requests sent right after delivery, to observe the new state (their replies are judged like cases). */
  readonly then?: readonly OperationCase[];
  /** NAP semantics of the delivered push, judged by `<domain>/semantics`. */
  readonly semantics?: {
    readonly rule: string;
    verify(push: Readonly<Record<string, unknown>> | null, replies: Readonly<Record<string, Readonly<Record<string, unknown>> | null>>): SemanticVerdict;
  };
}

/** A packaged or specified operation the fixture deliberately does not exercise. */
export interface OperationGap {
  readonly type: string;
  /**
   * `spec-gap`: the pinned NAP leaves a semantic decision open; `decision`
   * names it. `harness`: the first-party target cannot exercise it
   * deterministically (counted as uncovered, never as passing).
   */
  readonly kind: 'spec-gap' | 'harness';
  readonly decision: string;
  /** Bounded host policy applied, for `spec-gap`. */
  readonly policy?: string;
}

/** Everything the generic scenario needs for one domain. */
export interface DomainFixture {
  readonly domain: string;
  /** Extra host grants the probe needs (e.g. `relay` for an outbox case). */
  readonly alsoGrant?: readonly string[];
  readonly cases: readonly OperationCase[];
  readonly pushes?: readonly PushCase[];
  readonly gaps?: readonly OperationGap[];
}
