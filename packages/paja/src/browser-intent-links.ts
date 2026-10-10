/** Native-dialog review for parsed Paja intent links. */

import { normalizeIntentUri } from '@kehto/shell';

import type { ParsedPajaIntentLink } from './intent-link.js';

export interface PajaIntentReview {
  readonly uri: string;
  readonly payload?: unknown;
  readonly request: ReturnType<typeof normalizeIntentUri>;
}

export interface PajaIntentLinkReviewController {
  review(link: ParsedPajaIntentLink): Promise<PajaIntentReview | null>;
  dispose(): void;
}

/**
 * Create the host-owned incoming-link review. Opening a link only populates
 * controls; it never executes or fetches anything until the user chooses Launch.
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
  if (!(dialog instanceof HTMLDialogElement)
    || !(uri instanceof HTMLInputElement)
    || !(payload instanceof HTMLTextAreaElement)
    || !(target instanceof HTMLElement)
    || !(status instanceof HTMLElement)
    || !(cancel instanceof HTMLButtonElement)
    || !(launch instanceof HTMLButtonElement)) return null;

  let settle: ((value: PajaIntentReview | null) => void) | null = null;
  let trigger: HTMLElement | null = null;
  const finish = (value: PajaIntentReview | null) => {
    const done = settle;
    settle = null;
    if (dialog.open) dialog.close();
    trigger?.focus();
    trigger = null;
    done?.(value);
  };
  const cancelReview = () => finish(null);
  const launchReview = () => {
    try {
      const hasPayload = payload.value.trim().length > 0;
      const parsedPayload = hasPayload ? JSON.parse(payload.value) : undefined;
      const request = normalizeIntentUri(uri.value, hasPayload ? { payload: parsedPayload } : undefined);
      status.textContent = 'Accepted. Starting verified launcher…';
      finish({ uri: uri.value, ...(hasPayload ? { payload: parsedPayload } : {}), request });
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Intent link is invalid.';
    }
  };
  cancel.addEventListener('click', cancelReview);
  launch.addEventListener('click', launchReview);
  dialog.addEventListener('cancel', cancelReview);
  return {
    review(link) {
      if (settle) finish(null);
      uri.value = link.uri;
      payload.value = Object.hasOwn(link, 'payload') ? JSON.stringify(link.payload) : '';
      target.textContent = link.pointer
        ? 'This link names one verified target. You can choose another only after it fails verification.'
        : link.request.handlerHint
          ? 'This link recommends a named verified handler; your saved default remains separate.'
          : 'Paja will use your saved default or ask you to choose a compatible handler.';
      status.textContent = 'Review the URI and payload, then explicitly launch.';
      trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      uri.focus();
      return new Promise((resolve) => { settle = resolve; });
    },
    dispose() {
      cancel.removeEventListener('click', cancelReview);
      launch.removeEventListener('click', launchReview);
      dialog.removeEventListener('cancel', cancelReview);
      if (settle) finish(null);
    },
  };
}
