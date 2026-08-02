import {
  type PajaConfirmationHandler,
  type PajaConfirmationRequest,
} from './browser-adapter.js';
import { appendPajaMessageLog } from './browser-devtools.js';
import { createPajaSignerController } from './browser-signers.js';
import type { PajaBrowserState } from './browser-host.js';

/** Coordinates queued Paja operation confirmations. */
export interface PajaConfirmationController {
  /** Queue one request and resolve after the user approves or denies it. */
  readonly confirm: PajaConfirmationHandler;
  /** Deny queued work and detach host-page listeners. */
  dispose(): void;
}

interface PendingConfirmation {
  readonly request: PajaConfirmationRequest;
  readonly resolve: (allowed: boolean) => void;
}

interface ConfirmationCopy {
  readonly title: string;
  readonly summary: string;
  readonly details: string;
  readonly approveLabel: string;
}

/**
 * Create Paja's accessible, fail-closed confirmation queue.
 *
 * @param getState - Returns current Paja browser state for decision logging.
 * @returns Controller shared by signer, relay, link, and upload operations.
 */
export function createPajaConfirmationController(
  getState: () => PajaBrowserState | null,
): PajaConfirmationController {
  const dialog = document.getElementById('paja-confirmation-dialog');
  const title = document.getElementById('paja-confirmation-title');
  const summary = document.getElementById('paja-confirmation-summary');
  const details = document.getElementById('paja-confirmation-details');
  const approve = document.getElementById('paja-confirmation-approve');
  const deny = document.getElementById('paja-confirmation-deny');
  const ready = dialog instanceof HTMLDialogElement
    && title instanceof HTMLElement
    && summary instanceof HTMLElement
    && details instanceof HTMLElement
    && approve instanceof HTMLButtonElement
    && deny instanceof HTMLButtonElement;
  const queue: PendingConfirmation[] = [];
  let active: PendingConfirmation | null = null;
  let previousFocus: HTMLElement | null = null;
  let disposed = false;

  const pump = () => {
    if (!ready || disposed || active) return;
    active = queue.shift() ?? null;
    if (!active) return;
    const copy = describeConfirmation(active.request);
    title.textContent = copy.title;
    summary.textContent = copy.summary;
    details.textContent = copy.details;
    approve.textContent = copy.approveLabel;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    deny.focus();
  };

  const settle = (allowed: boolean) => {
    const current = active;
    if (!current) return;
    active = null;
    if (ready && dialog.open) dialog.close();
    recordPajaConfirmation(getState(), current.request, allowed);
    current.resolve(allowed);
    previousFocus?.focus();
    previousFocus = null;
    queueMicrotask(pump);
  };

  const onApprove = () => settle(true);
  const onDeny = () => settle(false);
  const onCancel = (event: Event) => {
    event.preventDefault();
    settle(false);
  };
  if (ready) {
    approve.addEventListener('click', onApprove);
    deny.addEventListener('click', onDeny);
    dialog.addEventListener('cancel', onCancel);
  }

  return {
    confirm(request) {
      if (!ready || disposed) {
        recordPajaConfirmation(getState(), request, false);
        return false;
      }
      return new Promise<boolean>((resolve) => {
        queue.push({ request, resolve });
        pump();
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (ready) {
        approve.removeEventListener('click', onApprove);
        deny.removeEventListener('click', onDeny);
        dialog.removeEventListener('cancel', onCancel);
      }
      settle(false);
      for (const pending of queue.splice(0)) {
        recordPajaConfirmation(getState(), pending.request, false);
        pending.resolve(false);
      }
    },
  };
}

function describeConfirmation(request: PajaConfirmationRequest): ConfirmationCopy {
  if (request.action === 'upload') {
    return {
      title: 'Upload this file?',
      summary: `${request.napplet.dTag} requests a public upload.`,
      details: [
        `Napplet: ${request.napplet.dTag} (${request.windowId})`,
        `File: ${request.filename ?? '(unnamed blob)'}`,
        `Size: ${request.size} bytes`,
        `Type: ${request.mimeType ?? 'application/octet-stream'}`,
        `Server: ${request.server}`,
        request.warning,
      ].join('\n'),
      approveLabel: 'Upload',
    };
  }
  if (request.action === 'link') {
    return {
      title: 'Open external link?',
      summary: `${request.napplet.dTag} requests browser navigation.`,
      details: [
        `Napplet: ${request.napplet.dTag} (${request.windowId})`,
        ...(request.label ? [`Label: ${request.label}`] : []),
        `Destination: ${request.url}`,
      ].join('\n'),
      approveLabel: 'Open link',
    };
  }
  const event = request.event as { kind?: unknown; content?: unknown };
  const kind = typeof event.kind === 'number' ? event.kind : 'unknown';
  const content = typeof event.content === 'string' && event.content.length > 0
    ? event.content.slice(0, 240)
    : '(empty content)';
  return {
    title: request.action === 'sign' ? 'Sign this Nostr event?' : 'Publish this Nostr event?',
    summary: request.action === 'sign'
      ? 'The active signer will authorize this event.'
      : 'Paja will send this event to the configured relay set.',
    details: `Kind: ${kind}\nContent: ${content}`,
    approveLabel: request.action === 'sign' ? 'Sign' : 'Publish',
  };
}

function recordPajaConfirmation(
  state: PajaBrowserState | null,
  request: PajaConfirmationRequest,
  allowed: boolean,
): void {
  if (request.action === 'upload') {
    appendPajaMessageLog(state, 'paja', {
      type: `paja.upload.${allowed ? 'confirmed' : 'denied'}`,
      windowId: request.windowId,
      dTag: request.napplet.dTag,
      aggregateHash: request.napplet.aggregateHash,
      filename: request.filename ?? '(unnamed blob)',
      size: request.size,
      mimeType: request.mimeType ?? 'application/octet-stream',
      server: request.server,
      warning: request.warning,
    });
    return;
  }
  if (request.action === 'link') {
    appendPajaMessageLog(state, 'paja', {
      type: `paja.link.${allowed ? 'confirmed' : 'denied'}`,
      windowId: request.windowId,
      dTag: request.napplet.dTag,
      aggregateHash: request.napplet.aggregateHash,
      url: request.url,
    });
    return;
  }
  const event = request.event as { kind?: unknown };
  appendPajaMessageLog(state, 'paja', {
    type: `paja.${request.action}.${allowed ? 'confirmed' : 'denied'}`,
    kind: typeof event.kind === 'number' ? event.kind : 'unknown',
  });
}

/**
 * Create the signer controller used by the browser host.
 *
 * @param getState - Returns the current Paja browser state.
 * @param refreshState - Refreshes host UI derived from signer state.
 * @returns A signer controller bound to the current host state.
 */
export function createHostSignerController(
  getState: () => PajaBrowserState | null,
  refreshState: (state: PajaBrowserState) => void,
  confirmRequest: PajaConfirmationHandler,
) {
  return createPajaSignerController({
    confirmRequest,
    onChange(signer) {
      const state = getState();
      if (!state) return;
      state.signer = signer;
      appendPajaMessageLog(state, 'paja', {
        type: `paja.signer.${signer.method}.${signer.status}`,
        pubkey: signer.pubkey,
        relay: signer.relay,
        error: signer.error,
      });
      refreshState(state);
      if (signer.status === 'connected') state.reload();
    },
  });
}

/**
 * Report whether a NIP-07 signer is injected into the current page.
 *
 * @returns Whether a non-null signer object is available.
 */
export function hasNip07Signer(): boolean {
  const signer = (globalThis as { nostr?: unknown }).nostr;
  return typeof signer === 'object' && signer !== null;
}
