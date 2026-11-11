import type { ApprovalAnswer, ApprovalPrompt, PermissionGrant, PermissionPrincipal } from '@kehto/runtime';
import {
  LIFETIME_LABELS, describeRequirement, principalIdentity, promptTitle, ruleTargetFor,
} from './browser-approval-format.js';
import { element } from './browser-approval-dom.js';

const MAX_PENDING_PROMPTS = 64;
const NETWORK_NOTE = 'Direct browser traffic to these origins is outside parent mediation and rate limits. '
  + 'Browser rules may also allow HTTP to HTTPS upgrades and WebSocket origins to match HTTP(S); '
  + 'hosts and port restrictions still apply, but default ports may upgrade with the scheme.';

type Lifetime = PermissionGrant['lifetime'];

/** A prompt answer plus whether the user asked for a standing rule instead. */
export interface PromptResult {
  readonly answer: ApprovalAnswer;
  /** Apply the answer to every future request the offered rule covers. */
  readonly asRule: boolean;
}

interface QueuedPrompt {
  readonly request: ApprovalPrompt;
  readonly resolve: (result: PromptResult) => void;
  readonly onAbort: () => void;
}

const CANCELLED: PromptResult = Object.freeze({ answer: Object.freeze({ effect: 'cancel' }), asRule: false });

function buildDialog(document: Document) {
  const dialog = element(document, 'dialog', undefined, 'kehto-approval-dialog');
  dialog.setAttribute('aria-labelledby', 'kehto-approval-title');
  dialog.setAttribute('aria-describedby', 'kehto-approval-description');
  const eyebrow = element(document, 'p', undefined, 'kehto-approval-eyebrow');
  const title = element(document, 'h2');
  title.id = 'kehto-approval-title';
  const description = element(document, 'p', undefined, 'kehto-approval-who');
  description.id = 'kehto-approval-description';
  const requirements = element(document, 'ul', undefined, 'kehto-approval-scopes');
  const mediation = element(document, 'p', undefined, 'kehto-approval-note');
  const identity = element(document, 'details', undefined, 'kehto-approval-identity');
  const identityText = element(document, 'p');
  identity.append(element(document, 'summary', 'Technical identity'), identityText);
  const remember = element(document, 'div', undefined, 'kehto-approval-remember');
  remember.setAttribute('role', 'group');
  remember.setAttribute('aria-label', 'Remember this decision');
  const rule = element(document, 'label', undefined, 'kehto-approval-rule');
  const ruleBox = element(document, 'input');
  ruleBox.type = 'checkbox';
  const ruleText = element(document, 'span');
  rule.append(ruleBox, ruleText);
  const actions = element(document, 'div', undefined, 'kehto-approval-actions');
  const deny = element(document, 'button', 'Deny');
  deny.type = 'button';
  const allow = element(document, 'button', 'Allow', 'kehto-approval-primary');
  allow.type = 'button';
  actions.append(deny, allow);
  dialog.append(eyebrow, title, description, requirements, mediation, identity, remember, rule, actions);
  return { dialog, eyebrow, title, description, requirements, mediation, identityText, remember, rule, ruleBox, ruleText, deny, allow };
}

/**
 * Serialize distinct host prompts while the runtime owns decisions and bounds.
 * A lifetime is preselected so one click answers; Escape cancels without a grant.
 *
 * @param document - Document that owns the dialog.
 * @param labelForPrincipal - Host display name for a trusted identity.
 * @param offersRule - Whether the host can store a standing rule from a prompt.
 */
export function createBrowserApprovalPrompt(
  document: Document,
  labelForPrincipal: (principal: PermissionPrincipal) => string,
  offersRule: () => boolean = () => false,
): { readonly dialog: HTMLDialogElement; prompt(request: ApprovalPrompt): Promise<PromptResult>; destroy(): void } {
  const view = buildDialog(document);
  const { dialog, deny, allow } = view;
  const queue: QueuedPrompt[] = [];
  let finishActive: ((result: PromptResult) => void) | undefined;
  let destroyed = false;

  function showQueue(): void {
    view.eyebrow.textContent = queue.length ? `Permission request · ${queue.length} more waiting` : 'Permission request';
  }

  function fill(request: ApprovalPrompt): void {
    const principal = request.request.principal;
    view.title.textContent = promptTitle(request.missing);
    view.description.replaceChildren(
      element(document, 'strong', labelForPrincipal(principal)),
      element(document, 'span', principal.kind === 'verified' ? 'verified' : 'development', 'kehto-approval-badge'),
      element(document, 'span', ' is asking to:'),
    );
    view.identityText.textContent = principalIdentity(principal);
    view.requirements.replaceChildren(...request.missing.map((item) => {
      const text = describeRequirement(item);
      const row = element(document, 'li');
      row.append(element(document, 'span', text.action));
      if (text.target !== undefined) row.append(element(document, 'code', text.target));
      return row;
    }));
    view.mediation.textContent = request.missing.some((item) => item.category === 'network' && item.operation.startsWith('network.'))
      ? NETWORK_NOTE : 'The parent mediates and limits this operation.';
    const target = offersRule() ? ruleTargetFor(request.missing) : undefined;
    view.rule.hidden = !target;
    view.ruleBox.checked = false;
    view.ruleText.textContent = target
      ? `Do this for every future ${target.operation ?? `${target.domain} interface`} request from this napplet`
      : '';
  }

  function present(request: ApprovalPrompt): Promise<PromptResult> {
    fill(request);
    showQueue();
    let selected: Lifetime | undefined = request.allowLifetimes[0];
    const choices = request.allowLifetimes.map((lifetime) => {
      const choice = element(document, 'button', LIFETIME_LABELS[lifetime]);
      choice.type = 'button';
      choice.value = lifetime;
      return choice;
    });
    const mark = (): void => {
      for (const choice of choices) {
        choice.setAttribute('aria-pressed', String(choice.value === selected));
        choice.disabled = view.ruleBox.checked;
      }
    };
    view.remember.replaceChildren(element(document, 'span', 'Remember'), ...choices);
    view.remember.hidden = choices.length < 2;
    allow.disabled = selected === undefined;
    mark();
    const priorFocus = document.activeElement;
    return new Promise<PromptResult>((resolve) => {
      let settled = false;
      const listeners: Array<() => void> = [];
      const listen = (target: EventTarget, type: string, listener: (event: Event) => void): void => {
        target.addEventListener(type, listener);
        listeners.push(() => target.removeEventListener(type, listener));
      };
      const finish = (result: PromptResult): void => {
        if (settled) return;
        settled = true;
        finishActive = undefined;
        for (const remove of listeners.splice(0)) remove();
        if (dialog.open) dialog.close();
        if (priorFocus && 'focus' in priorFocus && (priorFocus as HTMLElement).isConnected) {
          (priorFocus as HTMLElement).focus();
        }
        resolve(result);
      };
      finishActive = finish;
      listen(request.signal as unknown as EventTarget, 'abort', () => finish(CANCELLED));
      listen(deny, 'click', () => finish({ answer: { effect: 'deny', lifetime: 'once' }, asRule: view.ruleBox.checked }));
      listen(allow, 'click', () => {
        const asRule = view.ruleBox.checked;
        // A standing rule needs no exact grant beyond the life of this napplet.
        const lifetime = asRule && request.allowLifetimes.includes('session') ? 'session' : selected;
        if (lifetime) finish({ answer: { effect: 'allow', lifetime }, asRule });
      });
      for (const choice of choices) listen(choice, 'click', () => { selected = choice.value as Lifetime; mark(); });
      listen(view.ruleBox, 'change', mark);
      listen(dialog, 'cancel', (event) => { event.preventDefault(); finish(CANCELLED); });
      // A close event from the preceding prompt can arrive after this dialog
      // has reopened for the next request. Only a currently closed dialog can
      // cancel this request.
      listen(dialog, 'close', () => { if (!dialog.open) finish(CANCELLED); });
      // Focus starts on Deny so a stray Enter or Space can never grant access.
      try { dialog.showModal(); deny.focus(); }
      catch { finish(CANCELLED); }
    });
  }

  function pump(): void {
    if (destroyed || finishActive) return;
    const next = queue.shift();
    if (!next) return;
    next.request.signal.removeEventListener('abort', next.onAbort);
    if (next.request.signal.aborted) {
      next.resolve(CANCELLED);
      pump();
      return;
    }
    void present(next.request).then((result) => { next.resolve(result); pump(); });
  }

  function prompt(request: ApprovalPrompt): Promise<PromptResult> {
    if (destroyed || request.signal.aborted || queue.length + Number(!!finishActive) >= MAX_PENDING_PROMPTS) {
      return Promise.resolve(CANCELLED);
    }
    return new Promise((resolve) => {
      const queued: QueuedPrompt = {
        request, resolve,
        onAbort: () => {
          const index = queue.indexOf(queued);
          if (index < 0) return;
          queue.splice(index, 1);
          showQueue();
          resolve(CANCELLED);
        },
      };
      request.signal.addEventListener('abort', queued.onAbort, { once: true });
      queue.push(queued);
      showQueue();
      pump();
    });
  }

  function destroy(): void {
    destroyed = true;
    finishActive?.(CANCELLED);
    for (const queued of queue.splice(0)) {
      queued.request.signal.removeEventListener('abort', queued.onAbort);
      queued.resolve(CANCELLED);
    }
  }

  return { dialog, prompt, destroy };
}
