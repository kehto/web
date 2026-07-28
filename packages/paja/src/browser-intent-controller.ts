/**
 * Browser-owned NAP-INTENT target lifecycle policy.
 *
 * Retention is intentionally independent from browser frames. The host supplies
 * generation creation/reuse, source-bound readiness, current-generation checks,
 * and convention delivery. The controller resolves only after the target is
 * ready and the delivery is enqueued.
 *
 * @packageDocumentation
 */

import type {
  IntentDispatchParams,
  IntentTargetController,
  IntentTargetDispatch,
} from '@kehto/services';

/** Opaque current target generation controlled by the browser host. */
export interface BrowserIntentGeneration {
  /** Host-owned stable identifier for one target generation. */
  readonly id: string;
}

/** Terminal reasons exposed only to host observability and cleanup policy. */
export type BrowserIntentTerminalReason =
  | 'open-failed'
  | 'ready-failed'
  | 'no-current-target'
  | 'send-failed';

/** Browser lifecycle callbacks injected by the Paja host. */
export interface BrowserIntentControllerOptions {
  /** Open a compatible target or reuse its current generation. */
  openOrReuse(
    params: IntentDispatchParams,
    attempt: number,
  ): BrowserIntentGeneration | null | Promise<BrowserIntentGeneration | null>;
  /** Await source-bound NAP-SHELL readiness for a selected generation. */
  waitForReady(generation: BrowserIntentGeneration): void | Promise<void>;
  /** Return true only while the generation remains the selected current target. */
  isCurrent(generation: BrowserIntentGeneration): boolean | Promise<boolean>;
  /** Return the runtime-assigned window identifier once the target is ready. */
  getWindowId(generation: BrowserIntentGeneration): string | null;
  /** Send the convention through the ordinary carrier to the ready generation. */
  send(
    generation: BrowserIntentGeneration,
    params: IntentDispatchParams,
  ): void | Promise<void>;
  /** Maximum open/replacement attempts. Finite values clamp to 1–10; defaults to two. */
  maxAttempts?: number;
  /** Observe terminal target policy. */
  onTerminal?(params: IntentDispatchParams, reason: BrowserIntentTerminalReason): void;
}

const MAX_INTENT_DELIVERY_ATTEMPTS = 10;

/**
 * Creates/focuses a target and enqueues one convention delivery.
 */
export class BrowserIntentController implements IntentTargetController {
  private readonly maxAttempts: number;

  constructor(private readonly options: BrowserIntentControllerOptions) {
    this.maxAttempts = normalizeAttempts(options.maxAttempts);
  }

  async dispatch(params: IntentDispatchParams): Promise<IntentTargetDispatch> {
    const dispatch = freezeDispatch(params);
    let reason: BrowserIntentTerminalReason = 'no-current-target';
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let generation: BrowserIntentGeneration | null;
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
