import { createBrowserApprovalUi } from '@kehto/shell';
import type { BrowserApprovalUi } from '@kehto/shell';
import type { PermissionAdapter, PermissionGrant, PermissionPrincipal, RuntimePermissions } from '@kehto/runtime';

/** Versioned durable store used only by the runtime's validated grant format. */
export const PAJA_PERMISSION_STORAGE_KEY = 'kehto:paja:firewall-permissions:v1';

/** Paja's presentation, persistence, and lifecycle hooks for runtime approvals. */
export interface PajaPermissionAdapterOptions {
  readonly mount: HTMLElement;
  readonly getPermissions: () => RuntimePermissions | undefined;
  readonly onGrantRevoked?: (grant: PermissionGrant, durable: boolean) => void;
  readonly labelForPrincipal?: (principal: PermissionPrincipal) => string;
  /** Override only for embedding/tests; omitted uses the host's localStorage. */
  readonly storage?: Storage | null;
}

/** Runtime adapter and its non-authorizing browser presentation. */
export interface PajaPermissionAdapter {
  readonly adapter: PermissionAdapter;
  readonly ui: BrowserApprovalUi;
  destroy(): void;
}

function readStorage(): Storage | null {
  try { return window.localStorage; }
  catch { return null; }
}

/**
 * Bind Paja to the shared Firewall coordinator before ShellBridge construction.
 * The UI never copies grants; only the runtime validates and persists them.
 *
 * @param options - Mount, live runtime lookup, and frame retirement observer.
 * @returns An adapter to assign to ShellAdapter.permissions plus UI controls.
 * @example
 * ```ts
 * const permissions = createPajaPermissionAdapter({
 *   mount: document.getElementById('paja-permission-ui')!,
 *   getPermissions: () => bridge?.runtime.permissions,
 * });
 * adapter.permissions = permissions.adapter;
 * ```
 */
export function createPajaPermissionAdapter(options: PajaPermissionAdapterOptions): PajaPermissionAdapter {
  const storage = options.storage === undefined ? readStorage() : options.storage;
  const ui = createBrowserApprovalUi({
    mount: options.mount,
    getPermissions: options.getPermissions,
    labelForPrincipal: options.labelForPrincipal ?? ((principal) => principal.kind === 'verified' ? 'Verified napplet' : 'Development target'),
    onGrantRevoked: options.onGrantRevoked,
  });
  const adapter: PermissionAdapter = {
    now: Date.now,
    createCancellation: () => new AbortController(),
    schedule(callback, delayMs) {
      const timer = window.setTimeout(callback, delayMs);
      return () => window.clearTimeout(timer);
    },
    prompt: ui.prompt,
    onStorageError: ui.reportStorageError,
    ...(storage ? { persistence: {
      load: () => storage.getItem(PAJA_PERMISSION_STORAGE_KEY),
      persist: (serialized: string) => storage.setItem(PAJA_PERMISSION_STORAGE_KEY, serialized),
    } } : {}),
  };
  if (!storage) ui.reportStorageError('storage-unavailable');
  return { adapter, ui, destroy: () => ui.destroy() };
}
