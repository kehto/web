import type {
  ApprovalAnswer, ApprovalPrompt, PermissionGrant, PermissionPrincipal,
  PermissionStorageFailure, RuntimePermissions,
} from '@kehto/runtime';
import { createBrowserApprovalPrompt, principalIdentity } from './browser-approval-prompt.js';

/** Host-provided labels and live runtime grant management for one browser UI. */
export interface BrowserApprovalUiOptions {
  readonly mount: HTMLElement;
  /** Host display name; the technical verified identity is always shown too. */
  readonly labelForPrincipal: (principal: PermissionPrincipal) => string;
  /** Read the active runtime, which may be constructed after this UI. */
  readonly getPermissions: () => RuntimePermissions | undefined;
  /** Host lifecycle observer; it cannot grant authority. */
  readonly onGrantRevoked?: (grant: PermissionGrant, durable: boolean) => void;
  /** Observe whether the runtime can safely accept new grants. */
  readonly onStorageStateChanged?: (available: boolean) => void;
}

/** Common presentation adapter and live runtime-backed management controls. */
export interface BrowserApprovalUi {
  /** Resolve one runtime-owned prompt; Escape and closure cancel without a grant. */
  prompt(prompt: ApprovalPrompt): Promise<ApprovalAnswer>;
  /** Render a fresh snapshot from RuntimePermissions, never a UI-owned mirror. */
  refresh(): void;
  /** Show a durable-store failure with retry guidance. */
  reportStorageError(failure: PermissionStorageFailure): void;
  /** Release prompt listeners and remove the presentation surface. */
  destroy(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(document: Document, tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Create one accessible approval prompt and grant-management view. All
 * decisions, persistence, deduplication, and rate limits remain in the runtime.
 *
 * @param options - Host DOM mount, trusted label, live runtime, and observers.
 * @returns Prompt and management actions backed only by RuntimePermissions.
 * @example
 * ```ts
 * const ui = createBrowserApprovalUi({
 *   mount: document.getElementById('permissions')!,
 *   labelForPrincipal: () => 'Verified napplet',
 *   getPermissions: () => bridge?.runtime.permissions,
 * });
 * const permissions = { prompt: ui.prompt, onStorageError: ui.reportStorageError };
 * ```
 */
export function createBrowserApprovalUi(options: BrowserApprovalUiOptions): BrowserApprovalUi {
  const document = options.mount.ownerDocument;
  const root = element(document, 'section');
  root.className = 'kehto-approval-ui';
  const presenter = createBrowserApprovalPrompt(document, options.labelForPrincipal);

  const management = element(document, 'section');
  management.setAttribute('aria-label', 'Firewall grants');
  const heading = element(document, 'h2', 'Firewall grants');
  const status = element(document, 'p');
  status.setAttribute('role', 'alert');
  status.setAttribute('aria-live', 'assertive');
  const list = element(document, 'ul');
  const clear = element(document, 'button', 'Clear all grants');
  clear.type = 'button';
  const retry = element(document, 'button', 'Retry permission storage');
  retry.type = 'button';
  management.append(heading, status, list, clear, retry);
  root.append(presenter.dialog, management);
  options.mount.append(root);

  let destroyed = false;

  function refresh(): void {
    if (destroyed) return;
    const permissions = options.getPermissions();
    list.replaceChildren();
    if (!permissions) {
      status.textContent = 'Firewall permission runtime is unavailable.';
      clear.disabled = true;
      retry.disabled = true;
      options.onStorageStateChanged?.(false);
      return;
    }
    clear.disabled = permissions.grants.length === 0;
    retry.disabled = permissions.available;
    if (permissions.available && !status.dataset.storageFailure) status.textContent = '';
    if (!permissions.available) status.textContent ||= 'Permission storage is unavailable; new grants are blocked. Retry storage.';
    for (const grant of permissions.grants) {
      const row = element(document, 'li');
      const scope = grant.permission.scope;
      const detail = element(document, 'span', `${options.labelForPrincipal(grant.principal)} — ${principalIdentity(grant.principal)} — ${grant.effect} ${grant.permission.operation} ${scope.kind}:${scope.value} (${grant.lifetime})`);
      const revoke = element(document, 'button', 'Revoke');
      revoke.type = 'button';
      revoke.setAttribute('aria-label', `Revoke ${grant.permission.operation} ${scope.kind}:${scope.value}`);
      revoke.addEventListener('click', () => {
        const live = options.getPermissions();
        if (!live) return;
        const durable = live.revoke(grant.id);
        options.onGrantRevoked?.(grant, durable);
        if (!durable) reportStorageError('save-failed');
        refresh();
      });
      row.append(detail, revoke);
      list.append(row);
    }
    options.onStorageStateChanged?.(permissions.available);
  }

  function reportStorageError(failure: PermissionStorageFailure): void {
    if (destroyed) return;
    status.dataset.storageFailure = failure;
    status.textContent = failure === 'storage-unavailable'
      ? 'Persistent permission storage is unavailable; only session and once approvals can be offered.'
      : `Permission storage ${failure}. New approvals are blocked until storage succeeds; use Retry permission storage.`;
    refresh();
  }

  clear.addEventListener('click', () => {
    const permissions = options.getPermissions();
    if (!permissions) return;
    const grants = [...permissions.grants];
    const durable = permissions.clear();
    for (const grant of grants) options.onGrantRevoked?.(grant, durable);
    if (!durable) reportStorageError('save-failed');
    refresh();
  });
  retry.addEventListener('click', () => {
    const permissions = options.getPermissions();
    if (!permissions) return;
    if (permissions.retryPersistence()) {
      delete status.dataset.storageFailure;
      status.textContent = '';
    } else reportStorageError('save-failed');
    refresh();
  });

  async function prompt(request: ApprovalPrompt): Promise<ApprovalAnswer> {
    const answer = await presenter.prompt(request);
    // The coordinator commits the grant in its continuation of this promise.
    // Refresh in the following microtask so management reads runtime truth.
    queueMicrotask(() => queueMicrotask(refresh));
    return answer;
  }

  function destroy(): void {
    destroyed = true;
    presenter.destroy();
    root.remove();
  }

  refresh();
  return { prompt, refresh, reportStorageError, destroy };
}
