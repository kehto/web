import {
  type PajaConfirmationHandler,
  type PajaConfirmationRequest,
} from './browser-adapter.js';
import { appendPajaMessageLog } from './browser-devtools.js';
import { createPajaSignerController } from './browser-signers.js';
import {
  createPajaSignerConsentStore,
  isPajaSignerConsentContext,
  type PajaSignerConsentMatch,
  type PajaSignerRequestContext,
} from './browser-signer-consent.js';
import type { PajaBrowserState } from './browser-host.js';
import type { PajaUserActivationHandler } from './browser-device-services.js';

/** Coordinates queued Paja operation confirmations. */
export interface PajaConfirmationController {
  /** Queue one request and resolve after the user approves or denies it. */
  readonly confirm: PajaConfirmationHandler;
  /** Run a chooser or permission API synchronously from the approval click. */
  readonly activation: PajaUserActivationHandler;
  /** Remove every exact-identity signer decision remembered by Paja. */
  clearSignerConsent(): boolean;
  /** Count remembered kind and exact-napplet signer decisions. */
  getSignerConsentCount(): number;
  /** Deny queued work and detach host-page listeners. */
  dispose(): void;
}

/** Browser persistence and lifecycle callbacks for the confirmation UI. */
export interface PajaConfirmationControllerOptions {
  /** Durable signer-consent storage. Defaults to browser localStorage. */
  readonly storage?: Storage | null;
  /** Called after remembered signer decisions change. */
  readonly onSignerConsentChange?: (count: number) => void;
}

interface PendingConfirmation {
  readonly request: PajaConfirmationRequest;
  readonly approve: () => void;
  readonly deny: () => void;
}

interface ConfirmationCopy {
  readonly title: string;
  readonly summary: string;
  readonly details: string;
  readonly approveLabel: string;
}

type SignerApprovalMode =
  | 'once'
  | 'remember-kind'
  | 'trust-napplet'
  | 'remembered-kind'
  | 'remembered-napplet';

interface SignerConsentCandidate {
  readonly context: PajaSignerRequestContext;
  readonly kind: number;
}

function confirmationDetails(...lines: Array<string | undefined>): string {
  return lines.filter((line): line is string => line !== undefined).join('\n');
}

function confirmationCopy(
  title: string,
  summary: string,
  approveLabel: string,
  ...details: Array<string | undefined>
): ConfirmationCopy {
  return { title, summary, details: confirmationDetails(...details), approveLabel };
}

/**
 * Create Paja's accessible, fail-closed confirmation queue.
 *
 * @param getState - Returns current Paja browser state for decision logging.
 * @param options - Durable signer-consent storage and lifecycle callback
 * @returns Controller shared by signer, relay, link, and upload operations.
 */
export function createPajaConfirmationController(
  getState: () => PajaBrowserState | null,
  options: PajaConfirmationControllerOptions = {},
): PajaConfirmationController {
  const dialog = document.getElementById('paja-confirmation-dialog');
  const title = document.getElementById('paja-confirmation-title');
  const summary = document.getElementById('paja-confirmation-summary');
  const details = document.getElementById('paja-confirmation-details');
  const approve = document.getElementById('paja-confirmation-approve');
  const deny = document.getElementById('paja-confirmation-deny');
  const signerConsent = document.getElementById('paja-signer-consent');
  const signerConsentOnce = document.getElementById('paja-signer-consent-once');
  const signerConsentKind = document.getElementById('paja-signer-consent-kind');
  const signerConsentNapplet = document.getElementById('paja-signer-consent-napplet');
  const signerConsentKindValue = document.getElementById('paja-signer-consent-kind-value');
  const signerConsentNappletValue = document.getElementById('paja-signer-consent-napplet-value');
  const ready = dialog instanceof HTMLDialogElement
    && title instanceof HTMLElement
    && summary instanceof HTMLElement
    && details instanceof HTMLElement
    && approve instanceof HTMLButtonElement
    && deny instanceof HTMLButtonElement;
  const signerConsentReady = signerConsent instanceof HTMLFieldSetElement
    && signerConsentOnce instanceof HTMLInputElement
    && signerConsentKind instanceof HTMLInputElement
    && signerConsentNapplet instanceof HTMLInputElement
    && signerConsentKindValue instanceof HTMLElement
    && signerConsentNappletValue instanceof HTMLElement;
  const consentStore = createPajaSignerConsentStore(
    options.storage === undefined ? undefined : options.storage,
  );
  const queue: PendingConfirmation[] = [];
  let active: PendingConfirmation | null = null;
  let previousFocus: HTMLElement | null = null;
  let disposed = false;

  const reportSignerConsentChange = () => {
    options.onSignerConsentChange?.(consentStore.count());
  };

  const configureSignerConsent = (request: PajaConfirmationRequest) => {
    if (!signerConsentReady) return;
    signerConsent.hidden = true;
    signerConsentOnce.checked = true;
    signerConsentKind.checked = false;
    signerConsentNapplet.checked = false;
    const candidate = signerConsentCandidate(request);
    if (!candidate) return;
    signerConsent.hidden = false;
    signerConsentKindValue.textContent = String(candidate.kind);
    signerConsentNappletValue.textContent = candidate.context.napplet.dTag;
  };

  const rememberSignerChoice = (
    request: PajaConfirmationRequest,
  ): SignerApprovalMode => {
    if (!signerConsentReady) return 'once';
    const candidate = signerConsentCandidate(request);
    if (!candidate) return 'once';
    if (signerConsentNapplet.checked && consentStore.trustNapplet(candidate.context)) {
      reportSignerConsentChange();
      return 'trust-napplet';
    }
    if (signerConsentKind.checked && consentStore.rememberKind(candidate.context, candidate.kind)) {
      reportSignerConsentChange();
      return 'remember-kind';
    }
    return 'once';
  };

  const rememberedSignerChoice = (
    request: PajaConfirmationRequest,
  ): PajaSignerConsentMatch | null => {
    const candidate = signerConsentCandidate(request);
    return candidate ? consentStore.match(candidate.context, candidate.kind) : null;
  };

  const pump = () => {
    if (!ready || disposed || active) return;
    while (!active && queue.length > 0) {
      const candidate = queue.shift() ?? null;
      if (!candidate) break;
      const remembered = rememberedSignerChoice(candidate.request);
      if (!remembered) {
        active = candidate;
        break;
      }
      recordPajaConfirmation(
        getState(),
        candidate.request,
        true,
        remembered === 'kind' ? 'remembered-kind' : 'remembered-napplet',
      );
      candidate.approve();
    }
    if (!active) return;
    const copy = describeConfirmation(active.request);
    title.textContent = copy.title;
    summary.textContent = copy.summary;
    details.textContent = copy.details;
    approve.textContent = copy.approveLabel;
    configureSignerConsent(active.request);
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    deny.focus();
  };

  const settle = (allowed: boolean) => {
    const current = active;
    if (!current) return;
    active = null;
    if (ready && dialog.open) dialog.close();
    const approvalMode = allowed ? rememberSignerChoice(current.request) : undefined;
    recordPajaConfirmation(getState(), current.request, allowed, approvalMode);
    if (allowed) current.approve();
    else current.deny();
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
        queue.push({ request, approve: () => resolve(true), deny: () => resolve(false) });
        pump();
      });
    },
    activation: {
      run(request, operation) {
        if (!ready || disposed) {
          recordPajaConfirmation(getState(), request, false);
          return Promise.reject(new Error('user activation unavailable'));
        }
        return new Promise((resolve, reject) => {
          queue.push({
            request,
            approve() {
              let result;
              try {
                result = operation();
              } catch (error) {
                reject(error);
                return;
              }
              Promise.resolve(result).then(resolve, reject);
            },
            deny: () => reject(new Error(`${request.action} request denied`)),
          });
          pump();
        });
      },
    },
    clearSignerConsent() {
      const cleared = consentStore.clear();
      reportSignerConsentChange();
      return cleared;
    },
    getSignerConsentCount: () => consentStore.count(),
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
        pending.deny();
      }
    },
  };
}

function signerConsentCandidate(
  request: PajaConfirmationRequest,
): SignerConsentCandidate | null {
  if (request.action !== 'sign' || !request.signerContext) return null;
  if (!isPajaSignerConsentContext(request.signerContext)) return null;
  const kind = (request.event as { kind?: unknown }).kind;
  if (
    typeof kind !== 'number'
    || !Number.isSafeInteger(kind)
    || kind < 0
    || kind > 65_535
  ) return null;
  return { context: request.signerContext, kind };
}

function describeConfirmation(request: PajaConfirmationRequest): ConfirmationCopy {
  if (request.action === 'upload') {
    return confirmationCopy(
      'Upload this file?',
      `${request.napplet.dTag} requests a public upload.`,
      'Upload',
      `Napplet: ${request.napplet.dTag} (${request.windowId})`,
      `File: ${request.filename ?? '(unnamed blob)'}`,
      `Size: ${request.size} bytes`,
      `Type: ${request.mimeType ?? 'application/octet-stream'}`,
      `Server: ${request.server}`,
      request.warning,
    );
  }
  if (request.action === 'link') {
    return confirmationCopy(
      'Open external link?',
      `${request.napplet.dTag} requests browser navigation.`,
      'Open link',
      `Napplet: ${request.napplet.dTag} (${request.windowId})`,
      request.label ? `Label: ${request.label}` : undefined,
      `Destination: ${request.url}`,
    );
  }
  if (request.action === 'serial' || request.action === 'ble') {
    const device = request.action === 'serial' ? 'serial port' : 'Bluetooth device';
    return confirmationCopy(
      `Connect a ${device}?`,
      `A napplet requests access to a ${device}.`,
      'Choose device',
      `Napplet window: ${request.windowId}`,
      request.label ? `Purpose: ${request.label}` : undefined,
      request.details,
      'The browser will show its device chooser next.',
    );
  }
  if (request.action === 'notify') {
    return confirmationCopy(
      'Allow notifications?',
      `${request.napplet.dTag} requests permission to show shell notifications.`,
      'Allow notifications',
      `Napplet: ${request.napplet.dTag} (${request.windowId})`,
      `Identity: ${request.napplet.aggregateHash}`,
      `Channel: ${request.channel ?? 'all notifications'}`,
    );
  }
  if (request.action === 'webrtc') {
    return confirmationCopy(
      'Start a peer connection?',
      `${request.napplet.dTag} requests a WebRTC data session.`,
      'Connect',
      `Napplet: ${request.napplet.dTag} (${request.windowId})`,
      `Scope: ${request.scope}`,
      request.warning,
    );
  }
  if (request.action === 'dm') {
    return confirmationCopy(
      'Send this encrypted message?',
      'A napplet requests NIP-17 direct-message delivery.',
      'Send message',
      `Recipients: ${request.recipients.join(', ')}`,
      `Content: ${request.content.slice(0, 240)}`,
      request.warning,
    );
  }
  if (request.action === 'fs') {
    return confirmationCopy(
      'Choose filesystem access?',
      'A napplet requests a browser-mediated filesystem selection.',
      'Open chooser',
      `Napplet window: ${request.windowId}`,
      `Selection: ${request.kind}`,
      `Purpose: ${request.description}`,
      'The browser will show its file or directory chooser next.',
    );
  }
  if (!('event' in request)) throw new Error(`Unsupported confirmation action: ${request.action}`);
  const event = request.event as { kind?: unknown; content?: unknown };
  const kind = typeof event.kind === 'number' ? event.kind : 'unknown';
  const content = typeof event.content === 'string' && event.content.length > 0
    ? event.content.slice(0, 240)
    : '(empty content)';
  const signerContext = request.signerContext;
  return {
    title: request.action === 'sign' ? 'Sign this Nostr event?' : 'Publish this Nostr event?',
    summary: request.action === 'sign'
      ? signerContext
        ? `${signerContext.napplet.dTag} requests a signature from the active signer.`
        : 'A Paja host operation requests a signature from the active signer.'
      : 'Paja will send this event to the configured relay set.',
    details: confirmationDetails(
      signerContext
        ? `Napplet: ${signerContext.napplet.dTag} (${signerContext.windowId})`
        : undefined,
      signerContext ? `Identity hash: ${signerContext.napplet.aggregateHash}` : undefined,
      signerContext?.runtimeScope.startsWith('target-url:')
        ? `Target URL: ${signerContext.runtimeScope.slice('target-url:'.length)}`
        : undefined,
      signerContext ? `Signer: ${signerContext.signerPubkey}` : undefined,
      `Kind: ${kind}`,
      `Content: ${content}`,
    ),
    approveLabel: request.action === 'sign' ? 'Sign' : 'Publish',
  };
}

function recordPajaConfirmation(
  state: PajaBrowserState | null,
  request: PajaConfirmationRequest,
  allowed: boolean,
  signerApprovalMode?: SignerApprovalMode,
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
  if (request.action === 'serial' || request.action === 'ble') {
    appendPajaMessageLog(state, 'paja', {
      type: `paja.${request.action}.${allowed ? 'confirmed' : 'denied'}`,
      windowId: request.windowId,
      label: request.label,
    });
    return;
  }
  if (request.action === 'notify') {
    appendPajaMessageLog(state, 'paja', {
      type: `paja.notify.${allowed ? 'confirmed' : 'denied'}`,
      windowId: request.windowId,
      dTag: request.napplet.dTag,
      aggregateHash: request.napplet.aggregateHash,
      channel: request.channel,
    });
    return;
  }
  if (request.action === 'webrtc') {
    appendPajaMessageLog(state, 'paja', {
      type: `paja.webrtc.${allowed ? 'confirmed' : 'denied'}`,
      windowId: request.windowId,
      dTag: request.napplet.dTag,
      aggregateHash: request.napplet.aggregateHash,
    });
    return;
  }
  if (request.action === 'dm') {
    appendPajaMessageLog(state, 'paja', {
      type: `paja.dm.${allowed ? 'confirmed' : 'denied'}`,
      recipients: request.recipients,
    });
    return;
  }
  if (request.action === 'fs') {
    appendPajaMessageLog(state, 'paja', {
      type: `paja.fs.${allowed ? 'confirmed' : 'denied'}`,
      windowId: request.windowId,
      kind: request.kind,
    });
    return;
  }
  if (!('event' in request)) return;
  const event = request.event as { kind?: unknown };
  const signerContext = request.signerContext;
  appendPajaMessageLog(state, 'paja', {
    type: `paja.${request.action}.${allowed ? 'confirmed' : 'denied'}`,
    kind: typeof event.kind === 'number' ? event.kind : 'unknown',
    windowId: signerContext?.windowId,
    dTag: signerContext?.napplet.dTag,
    aggregateHash: signerContext?.napplet.aggregateHash,
    runtimeScope: signerContext?.runtimeScope,
    signerPubkey: signerContext?.signerPubkey,
    approval: signerApprovalMode,
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
