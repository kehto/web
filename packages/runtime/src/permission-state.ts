import {
  createPermissionState, deserializePermissions, revokePermissionGrant, serializePermissions,
} from '@kehto/firewall';
import type { PermissionPolicyOptions, PermissionState } from '@kehto/firewall';

/** Storage must throw on unsuccessful writes; durable grants are never best-effort. */
export interface PermissionPersistence {
  load(): string | null;
  persist(serialized: string): void;
}

export type PermissionStorageFailure = 'load-failed' | 'invalid-state' | 'unsupported-version' | 'save-failed' | 'storage-unavailable';

interface PermissionStoreOptions extends PermissionPolicyOptions {
  persistence?: PermissionPersistence;
  invalidate: (sessionId?: string) => void;
  onError?: (failure: PermissionStorageFailure) => void;
}

/** Internal state owner. Only validated pure-policy snapshots enter commit. */
export function createPermissionStore(options: PermissionStoreOptions) {
  let state = createPermissionState();
  let healthy = true;
  let loaded = false;
  let dirty = false;

  function report(failure: PermissionStorageFailure): void {
    try { options.onError?.(failure); } catch { /* Diagnostics cannot change policy. */ }
  }

  function save(next: PermissionState): void {
    if (!options.persistence) throw new Error('storage-unavailable');
    options.persistence.persist(serializePermissions(next));
  }

  function persistRevocation(): boolean {
    try {
      save(state);
      healthy = true;
      dirty = false;
      return true;
    } catch {
      healthy = false;
      dirty = true;
      report(options.persistence ? 'save-failed' : 'storage-unavailable');
      return false;
    }
  }

  return {
    getState: (): PermissionState => state,
    get available(): boolean { return healthy; },
    load(): boolean {
      // Never reload stale durable authority over an in-memory revocation.
      if (loaded || dirty) return healthy;
      loaded = true;
      try {
        const raw = options.persistence?.load();
        if (raw === null || raw === undefined || raw === '') return true;
        const parsed = deserializePermissions(raw, options);
        if (!parsed.ok) {
          healthy = false;
          report(parsed.reason);
          return false;
        }
        state = parsed.state;
        return true;
      } catch {
        healthy = false;
        report('load-failed');
        return false;
      }
    },
    commit(next: PermissionState): void {
      if (!healthy) throw new Error('Permission storage needs recovery');
      const changed = serializePermissions(next) !== serializePermissions(state);
      if (changed) {
        try { save(next); }
        catch {
          report(options.persistence ? 'save-failed' : 'storage-unavailable');
          throw new Error('Permission grant was not persisted');
        }
      }
      state = next;
    },
    revoke(id: string): boolean {
      const grant = state.grants.find((entry) => entry.id === id);
      if (!grant) return healthy;
      state = revokePermissionGrant(state, id);
      options.invalidate(grant.lifetime === 'persistent' ? undefined : grant.sessionId);
      return grant.lifetime !== 'persistent' || persistRevocation();
    },
    retire(sessionId: string): void {
      state = Object.freeze({ version: 1, grants: Object.freeze(state.grants.filter(
        (grant) => grant.lifetime === 'persistent' || grant.sessionId !== sessionId,
      )) });
      options.invalidate(sessionId);
    },
    clear(): boolean {
      state = createPermissionState();
      options.invalidate();
      if (!options.persistence) {
        healthy = true;
        dirty = false;
        return true;
      }
      return persistRevocation();
    },
    retryPersistence(): boolean {
      // A failed load requires explicit clear, not overwriting unseen records.
      if (!dirty) return healthy;
      return persistRevocation();
    },
  };
}
