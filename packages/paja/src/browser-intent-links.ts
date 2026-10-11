/** Recipient-facing shared-link launch and app choices. */

import type { IntentCandidate } from '@kehto/services';
import type { ParsedPajaIntentLink } from './intent-link.js';

/** Verified app labels presented when a recipient must make a choice. */
export interface PajaIntentApp {
  readonly id: string;
  readonly title: string;
}

/** Host observability for one shared-link navigation. */
export interface PajaIntentLinkProgress {
  isActive(): boolean;
  selectedTarget(title: string): void;
  chooseConflict(saved: PajaIntentApp, shared: PajaIntentApp): Promise<string | undefined>;
  accepted(): void;
  delivered(): void;
  failed(error: unknown): void;
}

export interface PajaIntentLinkController {
  open(link: ParsedPajaIntentLink, launch: (link: ParsedPajaIntentLink, progress: PajaIntentLinkProgress) => Promise<void>): void;
  chooseHandler(archetype: string, candidates: readonly IntentCandidate[]): Promise<string | undefined>;
  showError(error: unknown): void;
  dispose(): void;
}

/**
 * Open shared content directly, with an app choice only when routing needs one.
 * Successful delivery leaves the recipient in the app, without a review form.
 *
 * @param document - Host document containing app-choice and notice controls.
 * @param options - Explicit preference changes and consumed-navigation callbacks.
 * @returns A controller, or null when the host controls are absent.
 * @example
 * ```ts
 * const links = createPajaIntentLinkController();
 * ```
 */
export function createPajaIntentLinkController(
  document: Pick<Document, 'getElementById' | 'activeElement' | 'createElement'> = window.document,
  options: { setDefault?(archetype: string, id: string): void; onAccepted?(): void } = {},
): PajaIntentLinkController | null {
  const dialog = document.getElementById('paja-intent-link-dialog');
  const title = document.getElementById('paja-intent-link-title');
  const copy = document.getElementById('paja-intent-link-copy');
  const apps = document.getElementById('paja-intent-link-apps');
  const remember = document.getElementById('paja-intent-link-save-default');
  const cancel = document.getElementById('paja-intent-link-cancel');
  const notice = document.getElementById('paja-intent-link-notice');
  const status = document.getElementById('paja-intent-link-status');
  const retry = document.getElementById('paja-intent-link-retry');
  const dismiss = document.getElementById('paja-intent-link-dismiss');
  if (!(dialog instanceof HTMLDialogElement) || !(title instanceof HTMLElement)
    || !(copy instanceof HTMLElement) || !(apps instanceof HTMLElement)
    || !(remember instanceof HTMLInputElement) || !(cancel instanceof HTMLButtonElement)
    || !(notice instanceof HTMLElement) || !(status instanceof HTMLElement)
    || !(retry instanceof HTMLButtonElement) || !(dismiss instanceof HTMLButtonElement)) return null;

  let generation = 0;
  let run: (() => void) | undefined;
  let archetype = '';
  let settleChoice: ((id: string | undefined) => void) | undefined;
  let trigger: HTMLElement | null = null;
  const closeChoice = (id?: string) => {
    const settle = settleChoice;
    settleChoice = undefined;
    if (id && remember.checked) options.setDefault?.(archetype, id);
    if (dialog.open) dialog.close();
    trigger?.focus();
    trigger = null;
    settle?.(id);
  };
  const cancelChoice = () => { closeChoice(); generation += 1; notice.hidden = true; run = undefined; };
  const dismissNotice = () => { generation += 1; notice.hidden = true; run = undefined; closeChoice(); };
  const retryLink = () => run?.();
  const showError = (_error: unknown) => {
    status.textContent = 'Couldn’t open this shared content. Try again, or ask the sender for a new link.';
    notice.hidden = false;
    retry.hidden = !run;
  };
  const choose = (heading: string, description: string, candidates: readonly PajaIntentApp[]) => {
    closeChoice();
    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    title.textContent = heading;
    copy.textContent = description;
    remember.checked = false;
    apps.replaceChildren();
    for (const candidate of candidates) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Open with ${candidate.title}`;
      button.addEventListener('click', () => closeChoice(candidate.id));
      apps.append(button);
    }
    notice.hidden = true;
    const result = new Promise<string | undefined>((resolve) => { settleChoice = resolve; });
    dialog.showModal();
    return result;
  };
  cancel.addEventListener('click', cancelChoice);
  dialog.addEventListener('cancel', cancelChoice);
  dismiss.addEventListener('click', dismissNotice);
  retry.addEventListener('click', retryLink);

  return {
    open(link, launch) {
      dismissNotice();
      archetype = link.request.archetype;
      run = () => {
        const current = ++generation;
        let terminal = false;
        let consumed = false;
        const isActive = () => current === generation;
        const consume = () => { if (!consumed) { consumed = true; options.onAccepted?.(); } };
        status.textContent = 'Opening shared content…';
        notice.hidden = false;
        retry.hidden = true;
        const progress: PajaIntentLinkProgress = {
          isActive,
          selectedTarget(name) { if (isActive() && !terminal) status.textContent = `Opening ${name}…`; },
          chooseConflict: (saved, shared) => choose('Which app would you like to use?',
            `This link uses ${shared.title}. Your saved preference is ${saved.title}.`, [saved, shared]),
          accepted() { if (isActive()) consume(); },
          delivered() {
            if (!isActive() || terminal) return;
            terminal = true;
            consume();
            notice.hidden = true;
            run = undefined;
          },
          failed(error) { if (isActive() && !terminal) { terminal = true; showError(error); } },
        };
        void Promise.resolve().then(() => launch(link, progress)).catch(progress.failed);
      };
      run();
    },
    chooseHandler(role, candidates) {
      archetype = role;
      return choose('Choose an app', 'Open this shared content with:',
        candidates.map((candidate) => ({ id: candidate.id, title: candidate.title ?? 'Untitled app' })));
    },
    showError,
    dispose() {
      dismissNotice();
      cancel.removeEventListener('click', cancelChoice);
      dialog.removeEventListener('cancel', cancelChoice);
      dismiss.removeEventListener('click', dismissNotice);
      retry.removeEventListener('click', retryLink);
    },
  };
}
