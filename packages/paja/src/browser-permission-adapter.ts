import { createBrowserApprovalUi } from '@kehto/shell';
import type { BrowserApprovalUi } from '@kehto/shell';
import type { PermissionAdapter, PermissionGrant, PermissionPrincipal, RuntimePermissions } from '@kehto/runtime';
import { notePajaApprovalClick } from './browser-link.js';
import { createPajaPermissionRuleStore } from './browser-permission-rules.js';
import type { PajaPermissionRuleStore } from './browser-permission-rules.js';

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
  /** Default rules applied before a prompt; edited in the Firewall UI. */
  readonly rules: PajaPermissionRuleStore;
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
  const rules = createPajaPermissionRuleStore(storage);
  const ui = createBrowserApprovalUi({
    mount: options.mount,
    // A modal inside collapsed details/display:none still blocks the page,
    // but cannot show the decision admission is waiting for.
    promptMount: options.mount.ownerDocument.body,
    getPermissions: options.getPermissions,
    labelForPrincipal: options.labelForPrincipal ?? ((principal) => principal.kind === 'verified' ? 'Verified napplet' : 'Development target'),
    onGrantRevoked: options.onGrantRevoked,
    rules,
    onAnswer(answer, userGesture) {
      if (answer.effect === 'allow' && userGesture) notePajaApprovalClick();
    },
  });
  let refreshPending = false;
  const scheduleRefresh = (): void => {
    if (refreshPending) return;
    refreshPending = true;
    // One redraw per burst: a napplet can register hundreds of scopes at launch.
    window.setTimeout(() => { refreshPending = false; ui.refresh(); }, 0);
  };
  const adapter: PermissionAdapter = {
    now: Date.now,
    createCancellation: () => new AbortController(),
    schedule(callback, delayMs) {
      const timer = window.setTimeout(callback, delayMs);
      return () => window.clearTimeout(timer);
    },
    prompt: ui.prompt,
    defaultDecision(request, missing) {
      const decision = rules.decide(request, missing);
      // A rule grants without a prompt, so nothing else would redraw the list.
      if (decision === 'allow') scheduleRefresh();
      return decision;
    },
    onStorageError: ui.reportStorageError,
    ...(storage ? { persistence: {
      load: () => storage.getItem(PAJA_PERMISSION_STORAGE_KEY),
      persist: (serialized: string) => storage.setItem(PAJA_PERMISSION_STORAGE_KEY, serialized),
    } } : {}),
  };
  if (!storage) ui.reportStorageError('storage-unavailable');
  return { adapter, ui, rules, destroy: () => ui.destroy() };
}
