import {
  consumePermissionGrants, createPermissionState, evaluatePermissions,
  permissionPrincipalKey, putPermissionGrant,
} from '@kehto/firewall';
import type {
  PermissionGrant, PermissionPolicyOptions, PermissionPrincipal,
  PermissionRequest, PermissionRequirement, PermissionState,
} from '@kehto/firewall';

/** Host decisions can only grant the immutable scopes shown in the prompt. */
export interface ApprovalAnswer {
  readonly effect: 'allow' | 'deny';
  readonly lifetime: PermissionGrant['lifetime'];
}

export interface ApprovalPrompt {
  readonly request: PermissionRequest;
  readonly missing: readonly PermissionRequirement[];
  readonly signal: ApprovalSignal;
}

/** Structural subset accepted by browser and server AbortSignal implementations. */
export interface ApprovalSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

export interface ApprovalCancellation {
  readonly signal: ApprovalSignal;
  abort(): void;
}

export interface ApprovalCoordinatorOptions extends PermissionPolicyOptions {
  /** Host-generated globally unique token, independent of wire correlation IDs. */
  readonly createId: () => string;
  readonly createCancellation: () => ApprovalCancellation;
  /** Schedule a deadline and return its cancellation function. */
  readonly schedule: (callback: () => void, delayMs: number) => () => void;
  readonly prompt?: (prompt: ApprovalPrompt) => Promise<ApprovalAnswer>;
  readonly getState: () => PermissionState;
  /** Commit synchronously, persisting durable changes before publishing them. */
  readonly commit: (state: PermissionState) => void;
  readonly maxPending?: number;
  readonly timeoutMs?: number;
}

export type ApprovalOutcome<T> =
  | { readonly status: 'executed'; readonly value: T }
  | { readonly status: 'denied' | 'cancelled' | 'unavailable' | 'busy' };

interface PendingApproval {
  readonly sessionId: string;
  readonly controller: ApprovalCancellation;
}

/** Internal coordinator: domain adapters retain validation and wire responses. */
export function createApprovalCoordinator(options: ApprovalCoordinatorOptions) {
  const maxPending = options.maxPending ?? 64;
  const timeoutMs = options.timeoutMs ?? 60_000;
  if (!Number.isSafeInteger(maxPending) || maxPending < 1
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new RangeError('Invalid approval queue limits');
  }
  const pending = new Set<PendingApproval>();
  const groups = new Map<string, Promise<unknown>>();
  let disposed = false;

  function cancel(sessionId?: string): void {
    for (const entry of pending) {
      if (sessionId === undefined || entry.sessionId === sessionId) entry.controller.abort();
    }
  }

  function snapshot(principal: PermissionPrincipal, sessionId: string, requirements: readonly PermissionRequirement[]): PermissionRequest {
    const request = { principal: Object.freeze({ ...principal }), sessionId,
      requestId: options.createId(), requirements };
    // The pure evaluator validates and normalizes every scope and adds interface
    // requirements. Its detached missing list becomes the immutable prompt input.
    const normalized = evaluatePermissions(createPermissionState(), request, options).missing;
    return Object.freeze({ ...request, requirements: normalized });
  }

  async function approve(request: PermissionRequest, entry: PendingApproval, current: () => boolean): Promise<ApprovalOutcome<never> | undefined> {
    if (!current()) return { status: 'cancelled' };
    const state = options.getState();
    const decision = evaluatePermissions(state, request, options);
    if (decision.decision === 'deny') return { status: 'denied' };
    if (decision.decision === 'allow') return undefined;
    if (!options.prompt) return { status: 'unavailable' };
    let answer: ApprovalAnswer;
    try {
      answer = await options.prompt(Object.freeze({ request, missing: decision.missing, signal: entry.controller.signal }));
    } catch {
      return { status: current() ? 'unavailable' : 'cancelled' };
    }
    // A policy replacement while the UI is open invalidates its context. Hosts
    // also call cancel on revocation to dismiss the UI immediately.
    if (!current() || options.getState() !== state) return { status: 'cancelled' };
    if (!answer || (answer.effect !== 'allow' && answer.effect !== 'deny')
      || !['once', 'session', 'persistent'].includes(answer.lifetime)) return { status: 'unavailable' };
    if (answer.effect === 'deny' && answer.lifetime === 'once') return { status: 'denied' };
    try {
      let next = state;
      for (const [index, permission] of decision.missing.entries()) {
        next = putPermissionGrant(next, {
          id: `${request.requestId}-${index}`, principal: request.principal, permission,
          effect: answer.effect, lifetime: answer.lifetime,
          ...(answer.lifetime !== 'persistent' ? { sessionId: request.sessionId } : {}),
          ...(answer.lifetime === 'once' ? { requestId: request.requestId } : {}),
        }, options);
      }
      options.commit(next);
    } catch {
      return { status: 'unavailable' };
    }
    return answer.effect === 'deny' ? { status: 'denied' } : undefined;
  }

  function run<T>(
    principal: PermissionPrincipal,
    sessionId: string,
    requirements: readonly PermissionRequirement[],
    isCurrent: () => boolean,
    execute: (signal: ApprovalSignal) => T | Promise<T>,
  ): Promise<ApprovalOutcome<T>> {
    if (disposed) return Promise.resolve({ status: 'cancelled' });
    if (pending.size >= maxPending) return Promise.resolve({ status: 'busy' });
    let request: PermissionRequest;
    try { request = snapshot(principal, sessionId, requirements); }
    catch { return Promise.resolve({ status: 'denied' }); }
    const controller = options.createCancellation();
    const entry = { sessionId, controller };
    pending.add(entry);
    const current = () => !controller.signal.aborted && !disposed && isCurrent();
    const key = JSON.stringify([permissionPrincipalKey(request.principal), sessionId,
      request.requirements.map((item) => JSON.stringify(item)).sort()]);
    // Equivalent requests wait for the first prompt. A session grant releases
    // them after individual revalidation; a once grant prompts the next request.
    const previous = groups.get(key) ?? Promise.resolve();
    let clearDeadline: () => void;
    let onAbort: () => void;
    const cancelled = new Promise<ApprovalOutcome<T>>((resolve) => {
      onAbort = () => resolve({ status: 'cancelled' });
      controller.signal.addEventListener('abort', onAbort, { once: true });
      clearDeadline = options.schedule(() => controller.abort(), timeoutMs);
    });
    const operation = previous.then(async (): Promise<ApprovalOutcome<T>> => {
      const failure = await approve(request, entry, current);
      if (failure) return failure;
      if (!current()) return { status: 'cancelled' };
      const state = options.getState();
      const consumed = consumePermissionGrants(state, request, options);
      if (consumed.decision.decision !== 'allow') return { status: 'denied' };
      try {
        if (consumed.state.grants.length !== state.grants.length) options.commit(consumed.state);
      }
      catch { return { status: 'unavailable' }; }
      // No asynchronous boundary between final validation, consumption, and
      // invoking the action. Adapters receive cancellation for ongoing work.
      if (!current()) return { status: 'cancelled' };
      const executionState = options.getState();
      const value = await execute(controller.signal);
      return current() && options.getState() === executionState ? { status: 'executed', value } : { status: 'cancelled' };
    });
    const settled = Promise.race([operation, cancelled]).finally(() => {
      clearDeadline();
      controller.signal.removeEventListener('abort', onAbort);
      pending.delete(entry);
      if (groups.get(key) === tail) groups.delete(key);
    });
    // A failed action must not poison later operations in its queue.
    const tail = settled.then(() => undefined, () => undefined);
    groups.set(key, tail);
    return settled;
  }

  return {
    run,
    cancel,
    dispose(): void { disposed = true; cancel(); },
    get pendingCount(): number { return pending.size; },
  };
}
