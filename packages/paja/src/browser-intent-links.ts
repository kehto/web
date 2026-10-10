/** Native-dialog review for parsed Paja intent links. */

import { normalizeIntentUri } from '@kehto/shell';
import type { IntentCandidate } from '@kehto/services';
import type { ParsedPajaIntentLink } from './intent-link.js';

/** Edited request passed to the host only after an explicit Launch click. */
export interface PajaIntentReview {
  readonly uri: string;
  readonly pointer?: string;
  readonly payload?: unknown;
  readonly request: ReturnType<typeof normalizeIntentUri>;
}

/** Host callbacks that keep review visible across accepted delivery work. */
export interface PajaIntentReviewProgress {
  accepted(): void;
  delivered(): void;
  failed(error: unknown): void;
}

export interface PajaIntentLinkReviewController {
  review(link: ParsedPajaIntentLink, launch: (review: PajaIntentReview, progress: PajaIntentReviewProgress) => Promise<void>): Promise<void>;
  chooseHandler(archetype: string, candidates: readonly IntentCandidate[]): Promise<string | undefined>;
  consumeSaveDefault(): boolean;
  dispose(): void;
}

/**
 * Create the host-owned incoming-link review. Opening and editing only update
 * controls. The dialog remains open through resolving, accepted, and delivery
 * completion so failures have an explicit Retry/Choose another recovery path.
 */
export function createPajaIntentLinkReviewController(
  document: Pick<Document, 'getElementById' | 'activeElement'> = window.document,
): PajaIntentLinkReviewController | null {
  const dialog = document.getElementById('paja-intent-link-dialog');
  const uri = document.getElementById('paja-intent-link-uri');
  const payload = document.getElementById('paja-intent-link-payload');
  const target = document.getElementById('paja-intent-link-target');
  const status = document.getElementById('paja-intent-link-status');
  const cancel = document.getElementById('paja-intent-link-cancel');
  const launch = document.getElementById('paja-intent-link-launch');
  const retry = document.getElementById('paja-intent-link-retry');
  const choose = document.getElementById('paja-intent-link-choose');
  const handler = document.getElementById('paja-intent-link-handler');
  const useHandler = document.getElementById('paja-intent-link-use-handler');
  const saveDefault = document.getElementById('paja-intent-link-save-default');
  if (!(dialog instanceof HTMLDialogElement) || !(uri instanceof HTMLInputElement)
    || !(payload instanceof HTMLTextAreaElement) || !(target instanceof HTMLElement)
    || !(status instanceof HTMLElement) || !(cancel instanceof HTMLButtonElement)
    || !(launch instanceof HTMLButtonElement) || !(retry instanceof HTMLButtonElement)
    || !(choose instanceof HTMLButtonElement) || !(handler instanceof HTMLSelectElement)
    || !(useHandler instanceof HTMLButtonElement) || !(saveDefault instanceof HTMLInputElement)) return null;

  let settle: (() => void) | null = null;
  let trigger: HTMLElement | null = null;
  let pointer: string | undefined;
  let run: (() => void) | null = null;
  let chooseSettle: ((value: string | undefined) => void) | null = null;
  const setBusy = (busy: boolean) => {
    launch.disabled = busy;
    retry.disabled = busy || !run;
    choose.disabled = busy || pointer === undefined;
  };
  const setTargetCopy = () => {
    target.textContent = pointer
      ? 'This link names one verified target. If it cannot satisfy this exact convention, choose another deliberately.'
      : 'Paja will use your saved default, recommendation, or ask you to choose a compatible handler.';
  };
  const finish = () => {
    const done = settle;
    settle = null;
    run = null;
    chooseSettle?.(undefined);
    chooseSettle = null;
    if (dialog.open) dialog.close();
    trigger?.focus();
    trigger = null;
    done?.();
  };
  const cancelReview = () => finish();
  const chooseAnother = () => {
    pointer = undefined;
    setTargetCopy();
    status.textContent = 'Choose another removes the explicit target. Launch will use saved/default policy or a compatible chooser.';
    choose.disabled = true;
  };
  const retryReview = () => run?.();
  const launchReview = () => run?.();
  const useSelectedHandler = () => {
    const settleChoice = chooseSettle;
    chooseSettle = null;
    handler.disabled = true;
    useHandler.disabled = true;
    settleChoice?.(handler.value || undefined);
  };
  cancel.addEventListener('click', cancelReview);
  launch.addEventListener('click', launchReview);
  retry.addEventListener('click', retryReview);
  choose.addEventListener('click', chooseAnother);
  useHandler.addEventListener('click', useSelectedHandler);
  dialog.addEventListener('cancel', cancelReview);

  return {
    review(link, onLaunch) {
      if (settle) finish();
      uri.value = link.uri;
      pointer = link.pointer;
      payload.value = Object.hasOwn(link, 'payload') ? JSON.stringify(link.payload) : '';
      trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTargetCopy();
      status.textContent = 'Review the URI and payload, then explicitly launch.';
      run = () => {
        let review: PajaIntentReview;
        try {
          const hasPayload = payload.value.trim().length > 0;
          const parsedPayload = hasPayload ? JSON.parse(payload.value) : undefined;
          const request = normalizeIntentUri(uri.value, hasPayload ? { payload: parsedPayload } : undefined);
          review = { uri: uri.value, ...(pointer === undefined ? {} : { pointer }), ...(hasPayload ? { payload: parsedPayload } : {}), request };
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : 'Intent link is invalid.';
          return;
        }
        setBusy(true);
        status.textContent = 'Resolving verified handler policy…';
        const progress: PajaIntentReviewProgress = {
          accepted() { status.textContent = 'Accepted: delivery is queued and the target may still be loading.'; },
          delivered() { status.textContent = 'Delivered to the verified target.'; setBusy(false); },
          failed(error) {
            status.textContent = `Delivery failed: ${error instanceof Error ? error.message : String(error)}`;
            setBusy(false);
          },
        };
        void Promise.resolve().then(() => onLaunch(review, progress)).then(undefined, (error: unknown) => progress.failed(error));
      };
      setBusy(false);
      dialog.showModal();
      uri.focus();
      return new Promise((resolve) => { settle = resolve; });
    },
    chooseHandler(archetype, candidates) {
      if (chooseSettle) chooseSettle(undefined);
      handler.replaceChildren();
      for (const candidate of candidates) {
        const option = document.createElement('option');
        option.value = candidate.id;
        option.textContent = candidate.title ?? candidate.id;
        handler.append(option);
      }
      handler.disabled = candidates.length === 0;
      useHandler.disabled = candidates.length === 0;
      saveDefault.checked = false;
      status.textContent = `Choose a compatible handler for ${archetype}.`;
      return new Promise((resolve) => { chooseSettle = resolve; });
    },
    consumeSaveDefault() {
      const selected = saveDefault.checked;
      saveDefault.checked = false;
      return selected;
    },
    dispose() {
      cancel.removeEventListener('click', cancelReview);
      launch.removeEventListener('click', launchReview);
      retry.removeEventListener('click', retryReview);
      choose.removeEventListener('click', chooseAnother);
      useHandler.removeEventListener('click', useSelectedHandler);
      dialog.removeEventListener('cancel', cancelReview);
      finish();
    },
  };
}
