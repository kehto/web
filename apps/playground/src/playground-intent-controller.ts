/**
 * NAP-INTENT target lifecycle policy for the playground host.
 *
 * The controller relies on injected shell-host callbacks for verified target
 * creation, registered-source readiness, current-generation checks, and one
 * convention delivery. It has no iframe or INC routing state of its own.
 *
 * @packageDocumentation
 */

import type {
  IntentDispatchParams,
  IntentTargetController,
  IntentTargetDispatch,
} from '@kehto/services';

/** Opaque shell-host generation for a target iframe/source pair. */
export interface PlaygroundIntentGeneration {
  /** Host-owned generation identifier. */
  readonly id: string;
}

/** Terminal dispatch reasons visible only to host policy. */
export type PlaygroundIntentTerminalReason =
  | 'open-failed'
  | 'ready-failed'
  | 'no-current-target'
  | 'send-failed';

/** Lifecycle callbacks supplied by the playground shell host. */
export interface PlaygroundIntentControllerOptions {
  /** Open a verified cold target or reuse a compatible current target. */
  openOrReuse(
    params: IntentDispatchParams,
    attempt: number,
  ): PlaygroundIntentGeneration | null | Promise<PlaygroundIntentGeneration | null>;
  /** Await NAP-SHELL readiness from the generation's registered current source. */
  waitForReady(generation: PlaygroundIntentGeneration): void | Promise<void>;
  /** Return true only while this generation remains current for its target d-tag. */
  isCurrent(generation: PlaygroundIntentGeneration): boolean | Promise<boolean>;
  /** Return the runtime-assigned window identifier once the target is ready. */
  getWindowId(generation: PlaygroundIntentGeneration): string | null;
  /** Send the convention once to that current ready source. */
  send(
    generation: PlaygroundIntentGeneration,
    params: IntentDispatchParams,
  ): void | Promise<void>;
  /** Maximum open/replacement attempts. Finite values clamp to 1–10; defaults to two. */
  maxAttempts?: number;
  /** Observe terminal policy without manufacturing a second source result. */
  onTerminal?(params: IntentDispatchParams, reason: PlaygroundIntentTerminalReason): void;
}

const MAX_INTENT_DELIVERY_ATTEMPTS = 10;

/**
 * Creates/focuses a target and enqueues one convention delivery.
 *
 * @example
 * ```ts
 * const controller = new PlaygroundIntentController({ openOrReuse, waitForReady, isCurrent, send });
 * const target = await controller.dispatch(params);
 * ```
 */
export class PlaygroundIntentController implements IntentTargetController {
  private readonly maxAttempts: number;

  constructor(private readonly options: PlaygroundIntentControllerOptions) {
    this.maxAttempts = normalizeAttempts(options.maxAttempts);
  }

  async dispatch(params: IntentDispatchParams): Promise<IntentTargetDispatch> {
    const dispatch = freezeDispatch(params);
    let reason: PlaygroundIntentTerminalReason = 'no-current-target';
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let generation: PlaygroundIntentGeneration | null;
      try {
        generation = await this.options.openOrReuse(dispatch, attempt);
      } catch {
        reason = 'open-failed';
        continue;
      }
      if (!generation) {
        reason = 'open-failed';
        continue;
      }
      try {
        await this.options.waitForReady(generation);
      } catch {
        reason = 'ready-failed';
        continue;
      }
      if (!await this.options.isCurrent(generation)) {
        reason = 'no-current-target';
        continue;
      }
      try {
        await this.options.send(generation, dispatch);
        const windowId = this.options.getWindowId(generation);
        if (!windowId) throw new Error('intent target window is unavailable');
        return { windowId };
      } catch {
        this.options.onTerminal?.(dispatch, 'send-failed');
        throw new Error('intent target send failed');
      }
    }
    this.options.onTerminal?.(dispatch, reason);
    throw new Error(`intent target ${reason}`);
  }
}

function normalizeAttempts(value: number | undefined): number {
  if (value === undefined) return 2;
  if (!Number.isFinite(value)) throw new TypeError('maxAttempts must be finite');
  return Math.min(MAX_INTENT_DELIVERY_ATTEMPTS, Math.max(1, Math.floor(value)));
}

function freezeDispatch(params: IntentDispatchParams): IntentDispatchParams {
  if (!params || typeof params.handler !== 'string' || params.handler.length === 0) {
    throw new TypeError('Intent dispatch requires a handler');
  }
  if (
    typeof params.sender !== 'string'
    || params.sender.length === 0
    || typeof params.archetype !== 'string'
    || params.archetype.length === 0
    || typeof params.action !== 'string'
    || params.action.length === 0
    || typeof params.convention !== 'string'
    || params.convention.length === 0
  ) {
    throw new TypeError('Intent dispatch requires canonical routing fields');
  }
  const payload = freezeValue(params.payload);
  const behavior = params.behavior === undefined
    ? undefined
    : freezeValue({ ...params.behavior }) as NonNullable<IntentDispatchParams['behavior']>;
  return Object.freeze({
    handler: params.handler,
    sender: params.sender,
    archetype: params.archetype,
    action: params.action,
    convention: params.convention,
    ...(params.payload === undefined ? {} : { payload }),
    ...(behavior === undefined ? {} : { behavior }),
  });
}

function freezeValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (typeof value !== 'object' || value === null) return value;
  const existing = seen.get(value);
  if (existing !== undefined) return existing as T;
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) copy.push(freezeValue(item, seen));
    return Object.freeze(copy) as T;
  }
  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  for (const [key, item] of Object.entries(value)) copy[key] = freezeValue(item, seen);
  return Object.freeze(copy) as T;
}
