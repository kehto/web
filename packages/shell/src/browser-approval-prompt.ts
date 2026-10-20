import type { ApprovalAnswer, ApprovalPrompt, PermissionPrincipal } from '@kehto/runtime';

const MAX_PENDING_PROMPTS = 64;

function element<K extends keyof HTMLElementTagNameMap>(document: Document, tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Technical identity shown alongside a host-provided app label. */
export function principalIdentity(principal: PermissionPrincipal): string {
  return principal.kind === 'verified'
    ? `Verified manifest ${principal.manifestKey}; artifact SHA-256 ${principal.artifactHash}`
    : `Development target ${principal.target}; artifact SHA-256 ${principal.artifactHash}`;
}

interface QueuedPrompt {
  readonly request: ApprovalPrompt;
  readonly resolve: (answer: ApprovalAnswer) => void;
  readonly onAbort: () => void;
}

/** Serialize distinct host prompts while the runtime owns decisions and bounds. */
export function createBrowserApprovalPrompt(
  document: Document,
  labelForPrincipal: (principal: PermissionPrincipal) => string,
): { readonly dialog: HTMLDialogElement; prompt(request: ApprovalPrompt): Promise<ApprovalAnswer>; destroy(): void } {
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

  const queue: QueuedPrompt[] = [];
  let finishActive: ((answer: ApprovalAnswer) => void) | undefined;
  let destroyed = false;

  function present(request: ApprovalPrompt): Promise<ApprovalAnswer> {
    description.textContent = `Requested by ${labelForPrincipal(request.request.principal)}.`;
    identity.textContent = principalIdentity(request.request.principal);
    requirements.replaceChildren(...request.missing.map((item) => element(document, 'li',
      `${item.category} ${item.operation} ${item.scope.kind}:${item.scope.value}`)));
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
      // A close event from the preceding prompt can arrive after this dialog
      // has reopened for the next request. Only a currently closed dialog can
      // cancel this request.
      const onDialogClose = () => { if (!dialog.open) finish({ effect: 'cancel' }); };
      finishActive = finish;
      request.signal.addEventListener('abort', onAbort, { once: true });
      deny.addEventListener('click', onDeny);
      cancel.addEventListener('click', onCancel);
      allow.addEventListener('click', onAllow);
      lifetime.addEventListener('change', onLifetime);
      dialog.addEventListener('cancel', onDialogCancel);
      dialog.addEventListener('close', onDialogClose);
      try { dialog.showModal(); deny.focus(); }
      catch { finish({ effect: 'cancel' }); }
    });
  }

  function pump(): void {
    if (destroyed || finishActive) return;
    const next = queue.shift();
    if (!next) return;
    next.request.signal.removeEventListener('abort', next.onAbort);
    if (next.request.signal.aborted) {
      next.resolve({ effect: 'cancel' });
      pump();
      return;
    }
    void present(next.request).then((answer) => { next.resolve(answer); pump(); });
  }

  function prompt(request: ApprovalPrompt): Promise<ApprovalAnswer> {
    if (destroyed || request.signal.aborted || queue.length + Number(!!finishActive) >= MAX_PENDING_PROMPTS) {
      return Promise.resolve({ effect: 'cancel' });
    }
    return new Promise<ApprovalAnswer>((resolve) => {
      const onAbort = () => {
        const index = queue.findIndex((item) => item.onAbort === onAbort);
        if (index < 0) return;
        queue.splice(index, 1);
        resolve({ effect: 'cancel' });
      };
      request.signal.addEventListener('abort', onAbort, { once: true });
      queue.push({ request, resolve, onAbort });
      pump();
    });
  }

  function destroy(): void {
    destroyed = true;
    finishActive?.({ effect: 'cancel' });
    for (const next of queue.splice(0)) {
      next.request.signal.removeEventListener('abort', next.onAbort);
      next.resolve({ effect: 'cancel' });
    }
  }

  return { dialog, prompt, destroy };
}
