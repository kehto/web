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
  /** Whether this exact review run may still update its dialog. */
  isActive(): boolean;
  /** Show the readable title of a verified selected target before delivery. */
  selectedTarget(title: string): void;
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
 *
 * @param document - Host document that owns the native review controls.
 * @param options - Host callbacks for explicit default mutations.
 * @returns A review controller, or `null` when required controls are absent.
 * @example
 * ```ts
 * const review = createPajaIntentLinkReviewController();
 * ```
 */
export function createPajaIntentLinkReviewController(
  document: Pick<Document, 'getElementById' | 'activeElement' | 'createElement'> = window.document,
  options: { clearDefault?(archetype: string): void } = {},
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
  const clearDefault = document.getElementById('paja-intent-link-clear-default');
  if (!(dialog instanceof HTMLDialogElement) || !(uri instanceof HTMLInputElement)
    || !(payload instanceof HTMLTextAreaElement) || !(target instanceof HTMLElement)
    || !(status instanceof HTMLElement) || !(cancel instanceof HTMLButtonElement)
    || !(launch instanceof HTMLButtonElement) || !(retry instanceof HTMLButtonElement)
    || !(choose instanceof HTMLButtonElement) || !(handler instanceof HTMLSelectElement)
    || !(useHandler instanceof HTMLButtonElement) || !(saveDefault instanceof HTMLInputElement)) return null;
  const clearDefaultButton = clearDefault instanceof HTMLButtonElement ? clearDefault : null;

  let settle: (() => void) | null = null;
  let trigger: HTMLElement | null = null;
  let pointer: string | undefined;
  let forceChooser = false;
  let run: (() => void) | null = null;
  let chooseSettle: ((value: string | undefined) => void) | null = null;
  let activeArchetype: string | undefined;
  let generation = 0;
  let busy = false;
  const isCurrent = (runGeneration: number) => generation === runGeneration && settle !== null;
  const setBusy = (value: boolean) => {
    busy = value;
    launch.disabled = value;
    retry.disabled = value || !run;
    choose.disabled = value;
  };
  const setTargetCopy = () => {
    target.textContent = pointer
      ? 'This link names one verified target. If it cannot satisfy this exact convention, choose another deliberately.'
      : forceChooser
        ? 'Choose a compatible handler deliberately. This launch will not use a saved default or recommendation.'
        : 'Paja will use your saved default, recommendation, or ask you to choose a compatible handler.';
  };
  const finish = () => {
    generation += 1;
    busy = false;
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
    forceChooser = true;
    setTargetCopy();
    status.textContent = 'Choose another will open the compatible-handler chooser and bypass saved defaults.';
  };
  const retryReview = () => { if (!busy) run?.(); };
  const launchReview = () => { if (!busy) run?.(); };
  const useSelectedHandler = () => {
    const settleChoice = chooseSettle;
    chooseSettle = null;
    handler.disabled = true;
    useHandler.disabled = true;
    settleChoice?.(handler.value || undefined);
  };
  const clearSavedDefault = () => {
    if (!activeArchetype) return;
    options.clearDefault?.(activeArchetype);
    status.textContent = `Cleared the saved default for ${activeArchetype}.`;
  };
  cancel.addEventListener('click', cancelReview);
  launch.addEventListener('click', launchReview);
  retry.addEventListener('click', retryReview);
  choose.addEventListener('click', chooseAnother);
  useHandler.addEventListener('click', useSelectedHandler);
  clearDefaultButton?.addEventListener('click', clearSavedDefault);
  dialog.addEventListener('cancel', cancelReview);

  return {
    review(link, onLaunch) {
      if (settle) finish();
      uri.value = link.uri;
      pointer = link.pointer;
      forceChooser = false;
      payload.value = Object.hasOwn(link, 'payload') ? JSON.stringify(link.payload) : '';
      trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      activeArchetype = link.request.archetype;
      setTargetCopy();
      status.textContent = 'Review the URI and payload, then explicitly launch.';
      run = () => {
        if (busy) return;
        const runGeneration = ++generation;
        let review: PajaIntentReview;
        try {
          const hasPayload = payload.value.trim().length > 0;
          const parsedPayload = hasPayload ? JSON.parse(payload.value) : undefined;
          const request = normalizeIntentUri(uri.value, {
            ...(hasPayload ? { payload: parsedPayload } : {}),
            ...(forceChooser ? { handler: 'choose' } : {}),
          });
          if (pointer !== undefined && request.handlerHint !== undefined) {
            throw new TypeError('Paja intent link cannot combine a target pointer with a URI recommendation');
          }
          activeArchetype = request.archetype;
          review = { uri: uri.value, ...(pointer === undefined ? {} : { pointer }), ...(hasPayload ? { payload: parsedPayload } : {}), request };
        } catch (error) {
          if (isCurrent(runGeneration)) status.textContent = error instanceof Error ? error.message : 'Intent link is invalid.';
          return;
        }
        setBusy(true);
        status.textContent = 'Resolving verified handler policy…';
        // A reused target may finish before the launcher's acceptance reply.
        // Once terminal, a late reply must not move the review backwards.
        let terminal = false;
        const progress: PajaIntentReviewProgress = {
          isActive: () => isCurrent(runGeneration),
          selectedTarget(title) {
            if (!isCurrent(runGeneration)) return;
            target.textContent = `Verified target: ${title}`;
          },
          accepted() {
            if (!isCurrent(runGeneration) || terminal) return;
            status.textContent = 'Accepted: delivery is queued and the target may still be loading.';
          },
          delivered() {
            if (!isCurrent(runGeneration) || terminal) return;
            terminal = true;
            status.textContent = 'Delivered to the verified target.';
            setBusy(false);
          },
          failed(error) {
            if (!isCurrent(runGeneration) || terminal) return;
            terminal = true;
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
      activeArchetype = archetype;
      if (!dialog.open) {
        trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        pointer = undefined;
        forceChooser = true;
        uri.value = '';
        payload.value = '';
        setTargetCopy();
        dialog.showModal();
      }
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
      clearDefaultButton?.removeEventListener('click', clearSavedDefault);
      dialog.removeEventListener('cancel', cancelReview);
      finish();
    },
  };
}
