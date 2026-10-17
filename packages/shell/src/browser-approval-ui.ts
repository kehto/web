import type {
  ApprovalAnswer, ApprovalPrompt, PermissionGrant, PermissionPrincipal,
  PermissionStorageFailure, RuntimePermissions,
} from '@kehto/runtime';

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

function principalIdentity(principal: PermissionPrincipal): string {
  return principal.kind === 'verified'
    ? `Verified manifest ${principal.manifestKey}; artifact SHA-256 ${principal.artifactHash}`
    : `Development target ${principal.target}; artifact SHA-256 ${principal.artifactHash}`;
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
  const dialog = element(document, 'dialog');
  dialog.setAttribute('aria-labelledby', 'kehto-approval-title');
  dialog.setAttribute('aria-describedby', 'kehto-approval-description');
  const title = element(document, 'h2', 'Permission request');
  title.id = 'kehto-approval-title';
  const description = element(document, 'p');
  description.id = 'kehto-approval-description';
  const identity = element(document, 'p');
  const requirements = element(document, 'ul');
  const mediation = element(document, 'p');
  const lifetimeLabel = element(document, 'label', 'Allow for');
  const lifetime = element(document, 'select');
  lifetimeLabel.append(lifetime);
  const actions = element(document, 'div');
  const deny = element(document, 'button', 'Deny');
  deny.type = 'button';
  const cancel = element(document, 'button', 'Cancel');
  cancel.type = 'button';
  const allow = element(document, 'button', 'Allow');
  allow.type = 'button';
  actions.append(deny, cancel, allow);
  dialog.append(title, description, identity, requirements, mediation, lifetimeLabel, actions);

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
  root.append(dialog, management);
  options.mount.append(root);

  let finishActive: ((answer: ApprovalAnswer) => void) | undefined;
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
    status.textContent = `Permission storage ${failure}. New approvals are blocked until storage succeeds; use Retry permission storage.`;
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
    if (destroyed || request.signal.aborted || finishActive) return { effect: 'cancel' };
    description.textContent = `Requested by ${options.labelForPrincipal(request.request.principal)}.`;
    identity.textContent = principalIdentity(request.request.principal);
    requirements.replaceChildren(...request.missing.map((item) => element(document, 'li', `${item.category} ${item.operation} ${item.scope.kind}:${item.scope.value}`)));
    mediation.textContent = request.missing.some((item) => item.category === 'network' && item.operation.startsWith('network.'))
      ? 'Direct browser traffic to these origins is outside parent mediation and rate limits.'
      : 'The parent mediates and limits this operation.';
    lifetime.replaceChildren(element(document, 'option', 'Choose a lifetime'));
    lifetime.options[0].value = '';
    for (const offered of request.allowLifetimes) {
      const choice = element(document, 'option', offered);
      choice.value = offered;
      lifetime.append(choice);
    }
    lifetime.value = '';
    allow.disabled = true;
    const priorFocus = document.activeElement;
    return new Promise<ApprovalAnswer>((resolve) => {
      let settled = false;
      const finish = (answer: ApprovalAnswer): void => {
        if (settled) return;
        settled = true;
        finishActive = undefined;
        request.signal.removeEventListener('abort', onAbort);
        deny.removeEventListener('click', onDeny);
        cancel.removeEventListener('click', onCancel);
        allow.removeEventListener('click', onAllow);
        lifetime.removeEventListener('change', onLifetime);
        dialog.removeEventListener('cancel', onDialogCancel);
        dialog.removeEventListener('close', onDialogClose);
        if (dialog.open) dialog.close();
        if (priorFocus && 'focus' in priorFocus && (priorFocus as HTMLElement).isConnected) {
          (priorFocus as HTMLElement).focus();
        }
        resolve(answer);
      };
      const onAbort = () => finish({ effect: 'cancel' });
      const onDeny = () => finish({ effect: 'deny', lifetime: 'once' });
      const onCancel = () => finish({ effect: 'cancel' });
      const onAllow = () => {
        const selected = request.allowLifetimes.find((item) => item === lifetime.value);
        if (selected) finish({ effect: 'allow', lifetime: selected });
      };
      const onLifetime = () => { allow.disabled = !request.allowLifetimes.includes(lifetime.value as 'once'); };
      const onDialogCancel = (event: Event) => { event.preventDefault(); finish({ effect: 'cancel' }); };
      const onDialogClose = () => finish({ effect: 'cancel' });
      finishActive = finish;
      request.signal.addEventListener('abort', onAbort, { once: true });
      deny.addEventListener('click', onDeny);
      cancel.addEventListener('click', onCancel);
      allow.addEventListener('click', onAllow);
      lifetime.addEventListener('change', onLifetime);
      dialog.addEventListener('cancel', onDialogCancel);
      dialog.addEventListener('close', onDialogClose);
      try {
        dialog.showModal();
        deny.focus();
      } catch {
        finish({ effect: 'cancel' });
      }
    });
  }

  function destroy(): void {
    finishActive?.({ effect: 'cancel' });
    destroyed = true;
    root.remove();
  }

  refresh();
  return { prompt, refresh, reportStorageError, destroy };
}
