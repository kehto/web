import { permissionRuleSubject, resolvePermissionRule, setPermissionRule } from '@kehto/runtime';
import type {
  ApprovalAnswer, ApprovalPrompt, PermissionGrant, PermissionPrincipal,
  PermissionStorageFailure, RuntimePermissions,
} from '@kehto/runtime';
import { createBrowserApprovalPrompt } from './browser-approval-prompt.js';
import { createGrantList } from './browser-approval-grants.js';
import { createRulesEditor } from './browser-approval-rules.js';
import type { BrowserApprovalRules, RuleSubject } from './browser-approval-rules.js';
import { isRuleGrant, ruleTargetFor } from './browser-approval-format.js';
import { element } from './browser-approval-dom.js';

export type { BrowserApprovalRules } from './browser-approval-rules.js';

/** Host-provided labels and live runtime grant management for one browser UI. */
export interface BrowserApprovalUiOptions {
  readonly mount: HTMLElement;
  /** Optional always-visible mount for prompts when grant management can be hidden. Defaults to mount. */
  readonly promptMount?: HTMLElement;
  /** Host display name; the technical verified identity is always available too. */
  readonly labelForPrincipal: (principal: PermissionPrincipal) => string;
  /** Read the active runtime, which may be constructed after this UI. */
  readonly getPermissions: () => RuntimePermissions | undefined;
  /** Host lifecycle observer; it cannot grant authority. */
  readonly onGrantRevoked?: (grant: PermissionGrant, durable: boolean) => void;
  /** Observe whether the runtime can safely accept new grants. */
  readonly onStorageStateChanged?: (available: boolean) => void;
  /**
   * Host default rules. When present the UI shows a rule editor, offers a
   * standing rule from each prompt, and resets grants a changed rule no longer allows.
   */
  readonly rules?: BrowserApprovalRules;
  /**
   * Observe each answered prompt. `userGesture` is true only for a real pointer
   * or key press, so a host can run a gesture-gated browser action, such as
   * opening a tab, from the approving click. It cannot change the answer.
   */
  readonly onAnswer?: (answer: ApprovalAnswer, userGesture: boolean) => void;
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
// aislop-ignore-next-line complexity/function-too-long -- Prompt, rules and grant views share one destroy flag and one refresh.
export function createBrowserApprovalUi(options: BrowserApprovalUiOptions): BrowserApprovalUi {
  const document = options.mount.ownerDocument;
  const root = element(document, 'section', undefined, 'kehto-approval-ui');
  const promptRoot = options.promptMount ? element(document, 'section', undefined, 'kehto-approval-ui') : root;
  const presenter = createBrowserApprovalPrompt(document, options.labelForPrincipal, () => !!options.rules);
  let destroyed = false;

  const management = element(document, 'section', undefined, 'kehto-fw-management');
  management.setAttribute('aria-label', 'Firewall grants');
  const status = element(document, 'p', undefined, 'kehto-fw-error');
  status.setAttribute('role', 'alert');
  status.setAttribute('aria-live', 'assertive');
  const clear = element(document, 'button', '×', 'kehto-fw-icon');
  clear.type = 'button';
  clear.title = 'Clear all grants';
  clear.setAttribute('aria-label', 'Clear all grants');
  const retry = element(document, 'button', 'Retry permission storage');
  retry.type = 'button';
  const head = element(document, 'div', undefined, 'kehto-fw-head');
  head.append(element(document, 'h3', 'Firewall grants'), clear);

  function revoke(grants: readonly PermissionGrant[]): void {
    const live = options.getPermissions();
    if (!live) return;
    // Remove all authority before telling the host: a host that restarts a
    // napplet on the first notice must not have the rest revoked under it.
    const results = grants.map((grant) => [grant, live.revoke(grant.id)] as const);
    for (const [grant, durable] of results) options.onGrantRevoked?.(grant, durable);
    if (results.some(([, durable]) => !durable)) reportStorageError('save-failed');
    refresh();
  }

  function subjects(): RuleSubject[] {
    const seen = new Map<string, string>();
    for (const grant of options.getPermissions()?.grants ?? []) {
      const subject = permissionRuleSubject(grant.principal);
      if (!seen.has(subject)) seen.set(subject, options.labelForPrincipal(grant.principal));
    }
    return [...seen].map(([subject, label]) => ({ subject, label }));
  }

  /** A changed rule must not leave behind access it no longer allows. */
  function resetStaleRuleGrants(): void {
    const rules = options.rules?.get();
    const grants = options.getPermissions()?.grants ?? [];
    if (!rules) return;
    const stale = grants.filter((grant) => isRuleGrant(grant)
      && resolvePermissionRule(rules, grant.principal, grant.permission) !== 'allow');
    if (stale.length) revoke(stale);
    else refresh();
  }

  const grantList = createGrantList(document, { labelForPrincipal: options.labelForPrincipal, revoke });
  const rulesEditor = options.rules ? createRulesEditor(document, {
    rules: options.rules, subjects, onChange: resetStaleRuleGrants,
    suggestions: () => (options.getPermissions()?.grants ?? []).flatMap((grant) => [
      grant.permission.domain, ...(grant.permission.category === 'interface' ? [] : [grant.permission.operation]),
    ]),
  }) : undefined;

  management.append(head, status, retry, grantList.root);
  promptRoot.append(presenter.dialog);
  if (rulesEditor) root.append(rulesEditor.root);
  root.append(management);
  options.mount.append(root);
  options.promptMount?.append(promptRoot);

  function refresh(): void {
    if (destroyed) return;
    rulesEditor?.refresh();
    const permissions = options.getPermissions();
    if (!permissions) {
      grantList.render([]);
      status.textContent = 'Firewall permission runtime is unavailable.';
      clear.disabled = true;
      retry.disabled = true;
      retry.hidden = true;
      options.onStorageStateChanged?.(false);
      return;
    }
    clear.disabled = permissions.grants.length === 0;
    retry.disabled = permissions.available;
    retry.hidden = permissions.available;
    if (permissions.available && !status.dataset.storageFailure) status.textContent = '';
    if (!permissions.available) status.textContent ||= 'Permission storage is unavailable; new grants are blocked. Retry storage.';
    grantList.render(permissions.grants);
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

  /** Store the standing rule a prompt asked for; a failed save keeps the one-off answer. */
  function rememberAsRule(request: ApprovalPrompt, effect: 'allow' | 'deny'): void {
    const target = ruleTargetFor(request.missing);
    if (!options.rules || !target) return;
    try {
      const napplet = permissionRuleSubject(request.request.principal);
      options.rules.set(setPermissionRule(options.rules.get(), { napplet, ...target }, effect));
    } catch { /* The exact answer still applies to this request. */ }
  }

  async function prompt(request: ApprovalPrompt): Promise<ApprovalAnswer> {
    const { answer, asRule, userGesture } = await presenter.prompt(request);
    try { options.onAnswer?.(answer, userGesture); } catch { /* Observers cannot change the answer. */ }
    if (asRule && answer.effect !== 'cancel') rememberAsRule(request, answer.effect);
    // The coordinator commits the grant in its continuation of this promise.
    // Refresh in the following microtask so management reads runtime truth.
    queueMicrotask(() => queueMicrotask(refresh));
    return answer;
  }

  function destroy(): void {
    destroyed = true;
    presenter.destroy();
    if (promptRoot !== root) promptRoot.remove();
    root.remove();
  }

  refresh();
  return { prompt, refresh, reportStorageError, destroy };
}
