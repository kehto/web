import { permissionPrincipalKey } from '@kehto/firewall';
import type { PermissionGrant, PermissionRequirement } from '@kehto/firewall';
import { createApprovalCoordinator } from './approval-coordinator.js';
import type { ApprovalCoordinatorOptions, ApprovalOutcome, ApprovalSignal } from './approval-coordinator.js';
import { createPermissionStore } from './permission-state.js';
import type { PermissionPersistence, PermissionStorageFailure } from './permission-state.js';
import { createRateLimitState, defaultRateLimitConfig, evaluateRateLimit, retireRateLimitLifecycle } from './rate-limit.js';
import type { RateLimitConfig, RateLimitResult } from './rate-limit.js';
import type { SessionEntry } from './types.js';

/** Host UI, time, cancellation, and storage adapters for scoped approvals. */
export interface PermissionAdapter extends Pick<ApprovalCoordinatorOptions,
  'prompt' | 'createCancellation' | 'schedule' | 'extensions' | 'maxPending' | 'timeoutMs'> {
  /** Durable storage. Without it, persistent decisions fail explicitly. */
  readonly persistence?: PermissionPersistence;
  readonly onStorageError?: (failure: PermissionStorageFailure) => void;
  readonly now: () => number;
  /** Independent temporal policy; approvals cannot override it. */
  readonly rateLimit?: RateLimitConfig;
  /** Budget diagnostics omit payloads, URLs, and stored permission records. */
  readonly onRateLimit?: (event: PermissionRateEvent) => void;
}

/** Temporal enforcement diagnostic; never a grant decision. */
export interface PermissionRateEvent {
  readonly windowId: string;
  readonly operation: string;
  readonly action: RateLimitResult['action'];
  readonly reason: RateLimitResult['reason'];
}

/** Host management surface. Revocation failures require retry or explicit reset. */
export interface RuntimePermissions {
  /** Immutable granted/denied scopes, including ephemeral sessions. */
  readonly grants: readonly PermissionGrant[];
  /** False after a load failure or a durable revocation that could not be saved. */
  readonly available: boolean;
  /** Revoke locally immediately; false means durable removal failed. */
  revoke(id: string): boolean;
  /** Clear all grants and cancel live work; false means durable removal failed. */
  clear(): boolean;
  /** Retry an unsuccessful durable revocation, never reload stale authority. */
  retryPersistence(): boolean;
}

interface PermissionRuntimeContext {
  adapter: PermissionAdapter;
  createId: () => string;
  getSession: (windowId: string) => SessionEntry | undefined;
  allowed: (windowId: string, requirements: readonly PermissionRequirement[]) => boolean;
  focused: (windowId: string) => boolean;
  /** Close service operations affected by revocation. Undefined means all. */
  invalidate: (windowId?: string) => void;
}

/** Internal runtime binding: principals never come from app messages. */
export function createPermissionRuntime(context: PermissionRuntimeContext) {
  const { adapter } = context;
  const lifetimes = new Map<string, { entry: SessionEntry; id: string; subject: string; started: number }>();
  let rates = createRateLimitState();
  let disposed = false;
  let coordinator: ReturnType<typeof createApprovalCoordinator>;
  const store = createPermissionStore({
    persistence: adapter.persistence, extensions: adapter.extensions, onError: adapter.onStorageError,
    invalidate(sessionId) {
      coordinator?.cancel(sessionId);
      if (sessionId === undefined) context.invalidate();
      else {
        for (const [windowId, lifetime] of lifetimes) {
          if (lifetime.id === sessionId) context.invalidate(windowId);
        }
      }
    },
  });
  store.load();
  coordinator = createApprovalCoordinator({ ...adapter, createId: context.createId,
    getState: store.getState, commit: store.commit });

  function retire(windowId: string): void {
    const lifetime = lifetimes.get(windowId);
    if (!lifetime) return;
    // Remove first: retiring a source does not recursively request host cleanup.
    lifetimes.delete(windowId);
    store.retire(lifetime.id);
    rates = retireRateLimitLifecycle(rates, lifetime.subject, lifetime.id);
  }

  function run<T>(windowId: string, operation: string, requirements: readonly PermissionRequirement[],
    isCurrent: () => boolean, execute: (signal: ApprovalSignal) => T | Promise<T>): Promise<ApprovalOutcome<T>> {
    if (disposed) return Promise.resolve({ status: 'cancelled' });
    const entry = context.getSession(windowId);
    if (!entry?.permissionPrincipal || !store.available) return Promise.resolve({ status: 'unavailable' });
    if (entry.permissionPrincipal.artifactHash !== entry.aggregateHash) return Promise.resolve({ status: 'denied' });
    try {
      requirements = Object.freeze(requirements.map((item) => Object.freeze({ ...item, scope: Object.freeze({ ...item.scope }) })));
    } catch { return Promise.resolve({ status: 'denied' }); }
    let subject: string;
    try { subject = permissionPrincipalKey(entry.permissionPrincipal); }
    catch { return Promise.resolve({ status: 'denied' }); }
    let lifetime = lifetimes.get(windowId);
    if (lifetime?.entry !== entry) {
      retire(windowId);
      lifetime = { entry, id: context.createId(), subject, started: adapter.now() };
      lifetimes.set(windowId, lifetime);
    }
    const captured = lifetime;
    const current = () => !disposed && store.available && lifetimes.get(windowId) === captured
      && context.getSession(windowId) === entry && context.allowed(windowId, requirements) && isCurrent();
    if (!current()) return Promise.resolve({ status: 'denied' });
    try {
      const now = adapter.now();
      const rate = evaluateRateLimit(adapter.rateLimit ?? defaultRateLimitConfig(), rates, {
        subject, operation, lifecycle: lifetime.id, elapsedSinceStartMs: Math.max(0, now - lifetime.started),
        focused: context.focused(windowId), now,
      });
      rates = rate.state;
      if (rate.reason !== 'within-budget') {
        try { adapter.onRateLimit?.({ windowId, operation, action: rate.action, reason: rate.reason }); }
        catch { /* Audit failures cannot override temporal enforcement. */ }
      }
      if (!rate.allowed) return Promise.resolve({ status: 'busy' });
    } catch { return Promise.resolve({ status: 'unavailable' }); }
    return coordinator.run(entry.permissionPrincipal, lifetime.id, requirements, current, execute);
  }

  const management: RuntimePermissions = {
    get grants() { return store.getState().grants; },
    get available() { return store.available; },
    revoke: store.revoke,
    clear: store.clear,
    retryPersistence: store.retryPersistence,
  };
  return { management, run, retire, cancelPending(): void { coordinator.cancel(); }, cancelWindow(windowId: string): void {
    const lifetime = lifetimes.get(windowId);
    if (lifetime) coordinator.cancel(lifetime.id);
  }, destroy(): void {
    disposed = true;
    coordinator.dispose();
    for (const windowId of lifetimes.keys()) retire(windowId);
  } };
}
