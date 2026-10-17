import { evaluatePermissions, permissionPrincipalKey } from '@kehto/firewall';
import type { PermissionGrant, PermissionRequest, PermissionRequirement } from '@kehto/firewall';
import { createApprovalCoordinator } from './approval-coordinator.js';
import type { ApprovalCoordinatorOptions, ApprovalOutcome, ApprovalSignal } from './approval-coordinator.js';
import { createPermissionStore } from './permission-state.js';
import type { PermissionPersistence, PermissionStorageFailure } from './permission-state.js';
import { createRateLimitState, defaultRateLimitConfig, defaultPromptRateLimitConfig, evaluateRateLimit, retireRateLimitLifecycle } from './rate-limit.js';
import type { RateLimitConfig, RateLimitResult } from './rate-limit.js';
import type { SessionEntry } from './types.js';
import { createPermissionAdmission, interfaceRequirements } from './permission-admission.js';
import type { PermissionAdmission, PermissionAdmissionRequest } from './permission-admission.js';
export type { PermissionAdmission, PermissionAdmissionRequest } from './permission-admission.js';

/** Host UI, time, cancellation, and storage adapters for scoped approvals. */
export interface PermissionAdapter extends Pick<ApprovalCoordinatorOptions,
  'prompt' | 'createCancellation' | 'schedule' | 'extensions' | 'maxPending' | 'timeoutMs'> {
  /** Durable storage. Without it, persistent decisions fail explicitly. */
  readonly persistence?: PermissionPersistence;
  readonly onStorageError?: (failure: PermissionStorageFailure) => void;
  readonly now: () => number;
  /** Independent temporal policy; approvals cannot override it. */
  readonly rateLimit?: RateLimitConfig;
  /** Blocking UI-spam budgets, separate from operation budgets. */
  readonly promptRateLimit?: RateLimitConfig;
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
  /** Approve declared interfaces for a trusted provisional session before executing app bytes. */
  admit(windowId: string, request: PermissionAdmissionRequest): Promise<PermissionAdmission>;
  /** Revalidate an issued admission immediately before injecting namespaces/bytes. */
  isAdmissionCurrent(windowId: string, admission: PermissionAdmission): boolean;
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
  /** Observe grant invalidation so a host can retire an executing document. */
  subscribeInvalidation(listener: () => void): () => void;
}

interface PermissionRuntimeContext {
  adapter: PermissionAdapter;
  createId: () => string;
  getSession: (windowId: string) => SessionEntry | undefined;
  allowed: (windowId: string, requirements: readonly PermissionRequirement[], phase: 'admission' | 'operation') => boolean;
  focused: (windowId: string) => boolean;
  /** Close service operations affected by revocation. Undefined means all. */
  invalidate: (windowId?: string) => void;
}

/** Internal runtime binding: principals never come from app messages. */
export function createPermissionRuntime(context: PermissionRuntimeContext) {
  const { adapter } = context;
  const lifetimes = new Map<string, { entry: SessionEntry; id: string; subject: string; started: number }>();
  const retiredSources = new WeakSet<SessionEntry>();
  let rates = createRateLimitState();
  let promptRates = createRateLimitState();
  let disposed = false;
  let globalAdmissionRevision = 0;
  const sourceAdmissionRevisions = new WeakMap<SessionEntry, number>();
  const invalidationListeners = new Set<() => void>();
  let coordinator: ReturnType<typeof createApprovalCoordinator>;
  const store = createPermissionStore({
    persistence: adapter.persistence, extensions: adapter.extensions, onError: adapter.onStorageError,
    invalidate(sessionId) {
      if (sessionId === undefined) globalAdmissionRevision++;
      else {
        for (const lifetime of lifetimes.values()) {
          if (lifetime.id === sessionId) {
            sourceAdmissionRevisions.set(lifetime.entry, (sourceAdmissionRevisions.get(lifetime.entry) ?? 0) + 1);
          }
        }
      }
      coordinator?.cancel(sessionId);
      if (sessionId === undefined) context.invalidate();
      else {
        for (const [windowId, lifetime] of lifetimes) {
          if (lifetime.id === sessionId) context.invalidate(windowId);
        }
      }
      for (const listener of invalidationListeners) {
        try { listener(); } catch { /* Host diagnostics cannot change policy. */ }
      }
    },
  });
  store.load();
  coordinator = createApprovalCoordinator({ ...adapter, createId: context.createId,
    getState: store.getState, commit: store.commit, beforePrompt: chargePrompt });

  function chargePrompt(request: PermissionRequest): boolean {
    const source = [...lifetimes].find(([, lifetime]) => lifetime.id === request.sessionId);
    if (!source) return false;
    const [windowId, lifetime] = source;
    const now = adapter.now();
    const rate = evaluateRateLimit(adapter.promptRateLimit ?? defaultPromptRateLimitConfig(), promptRates, {
      subject: lifetime.subject, operation: 'permission.prompt', lifecycle: lifetime.id,
      elapsedSinceStartMs: Math.max(0, now - lifetime.started), focused: context.focused(windowId), now,
    });
    promptRates = rate.state;
    if (rate.reason !== 'within-budget') {
      try { adapter.onRateLimit?.({ windowId, operation: 'permission.prompt', action: rate.action, reason: rate.reason }); }
      catch { /* Diagnostics cannot authorize another prompt. */ }
    }
    return rate.allowed;
  }

  function retire(windowId: string): void {
    const lifetime = lifetimes.get(windowId);
    if (!lifetime) return;
    retiredSources.add(lifetime.entry);
    // Remove first: retiring a source does not recursively request host cleanup.
    lifetimes.delete(windowId);
    store.retire(lifetime.id);
    rates = retireRateLimitLifecycle(rates, lifetime.subject, lifetime.id);
    promptRates = retireRateLimitLifecycle(promptRates, lifetime.subject, lifetime.id);
  }

  function run<T>(windowId: string, operation: string, requirements: readonly PermissionRequirement[],
    isCurrent: () => boolean, execute: (signal: ApprovalSignal) => T | Promise<T>, phase: 'admission' | 'operation' = 'operation',
    signal?: ApprovalSignal): Promise<ApprovalOutcome<T>> {
    if (disposed || signal?.aborted) return Promise.resolve({ status: 'cancelled' });
    const entry = context.getSession(windowId);
    if (entry && retiredSources.has(entry)) return Promise.resolve({ status: 'cancelled' });
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
      && context.getSession(windowId) === entry && context.allowed(windowId, requirements, phase) && isCurrent();
    if (!current()) return Promise.resolve({ status: 'denied' });
    if (phase === 'operation') {
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
    }
    const allowedLifetimes = (phase === 'admission' ? ['session', 'persistent'] : ['once', 'session', 'persistent'])
      .filter((lifetime) => lifetime !== 'persistent' || !!adapter.persistence) as Array<PermissionGrant['lifetime']>;
    return coordinator.run(entry.permissionPrincipal, lifetime.id, requirements, current, execute, allowedLifetimes, signal);
  }


  function stillGranted(windowId: string, requirements: readonly PermissionRequirement[]): boolean {
    if (disposed || !store.available) return false;
    const lifetime = lifetimes.get(windowId);
    if (!lifetime || retiredSources.has(lifetime.entry) || context.getSession(windowId) !== lifetime.entry || !lifetime.entry.permissionPrincipal) return false;
    if (requirements.length === 0) return true;
    return evaluatePermissions({ version: 1, grants: store.getState().grants.filter((grant) => grant.lifetime !== 'once') }, {
      principal: lifetime.entry.permissionPrincipal, sessionId: lifetime.id, requestId: 'interface-admission-check',
      requirements,
    }, adapter).decision === 'allow';
  }


  const admission = createPermissionAdmission({
    getSession: context.getSession, available: () => !disposed && store.available,
    isRetired: (entry) => retiredSources.has(entry),
    revision: (windowId) => {
      const entry = context.getSession(windowId);
      return globalAdmissionRevision + (entry ? (sourceAdmissionRevisions.get(entry) ?? 0) : 0);
    },
    allowed: (windowId, requirements) => context.allowed(windowId, requirements, 'admission'),
    stillGranted, extensions: adapter.extensions,
    run: (windowId, requirements, current) => run(windowId, 'interface.admit', requirements, current, () => undefined, 'admission'),
  });

  const management: RuntimePermissions = {
    ...admission,
    get grants() { return store.getState().grants; },
    get available() { return store.available; },
    revoke: store.revoke,
    clear: store.clear,
    retryPersistence: store.retryPersistence,
    subscribeInvalidation(listener) {
      invalidationListeners.add(listener);
      return () => { invalidationListeners.delete(listener); };
    },
  };
  return { management, run, retire,
    close(windowId: string): void {
      const entry = context.getSession(windowId);
      if (entry) retiredSources.add(entry);
      retire(windowId);
    },
    isSourceActive(windowId: string): boolean {
      const entry = context.getSession(windowId);
      return !disposed && !!entry && !retiredSources.has(entry);
    },
    hasInterface: (windowId: string, domain: string): boolean => stillGranted(windowId, interfaceRequirements([domain])),
    cancelPending(): void { coordinator.cancel(); }, cancelWindow(windowId: string): void {
    const lifetime = lifetimes.get(windowId);
    if (lifetime) coordinator.cancel(lifetime.id);
  }, destroy(): void {
    disposed = true;
    invalidationListeners.clear();
    coordinator.dispose();
    for (const windowId of lifetimes.keys()) retire(windowId);
  } };
}
