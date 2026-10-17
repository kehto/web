import { createBrowserApprovalUi, type BrowserApprovalUi } from '@kehto/shell';
import type {
  PermissionAdapter, PermissionGrant, PermissionPrincipal, RuntimePermissions,
} from '@kehto/runtime';

/** Versioned runtime grant storage, separate from playground preferences. */
export const PLAYGROUND_PERMISSION_STORAGE_KEY = 'kehto:playground:firewall-permissions:v1';

/** Browser presentation and persistence inputs for the playground host. */
export interface PlaygroundPermissionAdapterOptions {
  readonly mount: HTMLElement;
  readonly getPermissions: () => RuntimePermissions | undefined;
  readonly onGrantRevoked?: (grant: PermissionGrant, durable: boolean) => void;
  readonly storage?: Storage | null;
}

/** The runtime adapter and its shared approval/grant-management view. */
export interface PlaygroundPermissionAdapter {
  readonly adapter: PermissionAdapter;
  readonly ui: BrowserApprovalUi;
  destroy(): void;
}

function localStorageOrNull(): Storage | null {
  try { return window.localStorage; }
  catch { return null; }
}

/**
 * Bind playground prompts and durable storage to the runtime's sole grant store.
 *
 * @param options - Host mount, live runtime lookup, and revocation observer.
 * @returns The adapter to install before ShellBridge construction.
 * @example
 * ```ts
 * const controller = createPlaygroundPermissionAdapter({
 *   mount: document.getElementById('firewall-grants')!,
 *   getPermissions: () => bridge?.runtime.permissions,
 * });
 * hooks.permissions = controller.adapter;
 * ```
 */
export function createPlaygroundPermissionAdapter(
  options: PlaygroundPermissionAdapterOptions,
): PlaygroundPermissionAdapter {
  const storage = options.storage === undefined ? localStorageOrNull() : options.storage;
  const ui = createBrowserApprovalUi({
    mount: options.mount,
    getPermissions: options.getPermissions,
    labelForPrincipal: (principal: PermissionPrincipal) =>
      principal.kind === 'verified' ? 'Verified napplet' : 'Development target',
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
      load: () => storage.getItem(PLAYGROUND_PERMISSION_STORAGE_KEY),
      persist: (serialized: string) => storage.setItem(PLAYGROUND_PERMISSION_STORAGE_KEY, serialized),
    } } : {}),
  };
  if (!storage) ui.reportStorageError('storage-unavailable');
  return { adapter, ui, destroy: () => ui.destroy() };
}
