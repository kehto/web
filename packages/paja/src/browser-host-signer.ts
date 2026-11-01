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
  /** Deny pending operations when their endpoint is removed. */
  cancelWindow(windowId: string): void;
  /** Deny pending signing/publication when the active account changes. */
  cancelSignerRequests(): void;
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
  | 'trust-version'
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

function createSignerConsentChoices(
  consentStore: ReturnType<typeof createPajaSignerConsentStore>,
  reportSignerConsentChange: () => void,
) {
  const signerConsent = document.getElementById('paja-signer-consent');
  const signerConsentOnce = document.getElementById('paja-signer-consent-once');
  const signerConsentKind = document.getElementById('paja-signer-consent-kind');
  const signerConsentNapplet = document.getElementById('paja-signer-consent-napplet');
  const signerConsentVersion = document.getElementById('paja-signer-consent-version');
  const signerConsentKindValue = document.getElementById('paja-signer-consent-kind-value');
  const signerConsentNappletValue = document.getElementById('paja-signer-consent-napplet-value');
  const signerConsentReady = signerConsent instanceof HTMLFieldSetElement
    && signerConsentOnce instanceof HTMLInputElement
    && signerConsentKind instanceof HTMLInputElement
    && signerConsentNapplet instanceof HTMLInputElement
    && signerConsentKindValue instanceof HTMLElement
    && signerConsentNappletValue instanceof HTMLElement;
  const configureSignerConsent = (request: PajaConfirmationRequest) => {
    if (!signerConsentReady) return;
    signerConsent.hidden = true;
    signerConsentOnce.checked = true;
    signerConsentKind.checked = false;
    signerConsentNapplet.checked = false;
    if (signerConsentVersion instanceof HTMLInputElement) signerConsentVersion.checked = false;
    const candidate = signerConsentCandidate(request);
    if (!candidate) return;
    signerConsent.hidden = false;
    signerConsentKindValue.textContent = String(candidate.kind);
    signerConsentNappletValue.textContent = candidate.context.napplet.dTag || 'Root napplet';
    const verb = request.action === 'publish' ? 'Publish' : 'Sign';
    for (const [id, text] of [
      ['paja-signer-consent-legend', `Remember this ${request.action === 'publish' ? 'publishing' : 'signing'} choice`],
      ['paja-signer-consent-once-label', `${verb} this event only`],
      ['paja-signer-consent-kind-verb', `Always ${verb.toLowerCase()} kind`],
      ['paja-signer-consent-napplet-verb', `Allow all ${request.action === 'publish' ? 'publishing' : 'signing'} from`],
      ['paja-signer-consent-warning', `Paja will ${verb.toLowerCase()} any event this napplet version requests without asking again. A different version or signer needs new approval.`],
    ]) {
      const element = document.getElementById(id);
      if (element) element.textContent = text;
    }
  };

  const rememberSignerChoice = (
    request: PajaConfirmationRequest,
  ): SignerApprovalMode => {
    if (!signerConsentReady) return 'once';
    const candidate = signerConsentCandidate(request);
    if (!candidate) return 'once';
    if (signerConsentVersion instanceof HTMLInputElement && signerConsentVersion.checked && consentStore.trustVersion(candidate.context)) {
      reportSignerConsentChange();
      return 'trust-version';
    }
    const action = request.action === 'publish' ? 'publish' : 'sign';
    if (signerConsentNapplet.checked && consentStore.trustNapplet(candidate.context, action)) {
      reportSignerConsentChange();
      return 'trust-napplet';
    }
    if (signerConsentKind.checked && consentStore.rememberKind(candidate.context, candidate.kind, action)) {
      reportSignerConsentChange();
      return 'remember-kind';
    }
    return 'once';
  };

  const rememberedSignerChoice = (
    request: PajaConfirmationRequest,
  ): PajaSignerConsentMatch | null => {
    const candidate = signerConsentCandidate(request);
    return candidate ? consentStore.match(candidate.context, candidate.kind, request.action === 'publish' ? 'publish' : 'sign') : null;
  };

  return { configure: configureSignerConsent, remember: rememberSignerChoice, match: rememberedSignerChoice };
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
  const ready = dialog instanceof HTMLDialogElement
    && title instanceof HTMLElement
    && summary instanceof HTMLElement
    && details instanceof HTMLElement
    && approve instanceof HTMLButtonElement
    && deny instanceof HTMLButtonElement;
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

  const choices = createSignerConsentChoices(consentStore, reportSignerConsentChange);

  const pump = () => {
    if (!ready || disposed || active) return;
    while (!active && queue.length > 0) {
      const candidate = queue.shift() ?? null;
      if (!candidate) break;
      if (!isRequestCurrent(candidate.request)) { recordPajaConfirmation(getState(), candidate.request, false); candidate.deny(); continue; }
      const remembered = choices.match(candidate.request);
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
    choices.configure(active.request);
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    deny.focus();
  };

  const settle = (allowed: boolean) => {
    const current = active;
    if (!current) return;
    allowed = allowed && isRequestCurrent(current.request);
    active = null;
    if (ready && dialog.open) dialog.close();
    const approvalMode = allowed ? choices.remember(current.request) : undefined;
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

  const cancelMatching = (matches: (request: PajaConfirmationRequest) => boolean) => {
    for (let index = queue.length - 1; index >= 0; index--) {
      const pending = queue[index]!;
      if (!matches(pending.request)) continue;
      queue.splice(index, 1);
      recordPajaConfirmation(getState(), pending.request, false);
      pending.deny();
    }
    if (active && matches(active.request)) settle(false);
  };

  return {
    confirm(request) {
      if (!ready || disposed || request.signal?.aborted) {
        recordPajaConfirmation(getState(), request, false);
        return false;
      }
      const { signal } = request;
      return new Promise<boolean>((resolve) => {
        const withdraw = () => cancelMatching((candidate) => candidate === request);
        const detach = () => signal?.removeEventListener('abort', withdraw);
        signal?.addEventListener('abort', withdraw, { once: true });
        queue.push({ request, approve: () => { detach(); resolve(true); }, deny: () => { detach(); resolve(false); } });
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
    cancelWindow(windowId) {
      cancelMatching(request => ('windowId' in request ? request.windowId : 'signerContext' in request ? request.signerContext?.windowId : undefined) === windowId);
    },
    cancelSignerRequests() { cancelMatching(request => request.action === 'sign' || request.action === 'publish'); },
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
  if ((request.action !== 'sign' && request.action !== 'publish') || !request.signerContext) return null;
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

function isRequestCurrent(request: PajaConfirmationRequest): boolean {
  if (request.signal?.aborted) return false;
  if (request.isCurrent && !request.isCurrent()) return false;
  return !('signerContext' in request) || !request.signerContext?.isCurrent || request.signerContext.isCurrent();
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
      `Version: ${request.napplet.aggregateHash}`,
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
  if (request.action === 'llm') {
    return confirmationCopy(
      'Send this prompt to a language model?',
      `${request.napplet.dTag} requests a generation from ${request.connection}.`,
      'Send prompt',
      `Napplet: ${request.napplet.dTag} (${request.windowId})`,
      `Version: ${request.napplet.aggregateHash}`,
      `Route: ${request.route}`,
      `Model: ${request.model}`,
      `Disclosed: ${request.messages} message(s), ${request.characters} characters, ${request.images} image(s); ${request.format} output`,
      request.warning,
    );
  }
  if (request.action === 'llm-configure') {
    return confirmationCopy(
      'Configure a language model connection?',
      `${request.napplet.dTag} asked for a model but no compatible connection is configured.`,
      'Open Language models',
      `Napplet: ${request.napplet.dTag} (${request.windowId})`,
      `Requested: ${request.requirements}`,
      `Configured connections: ${request.configured}`,
      'Approving opens the Language models panel. The napplet receives an explicit unsupported result until a connection exists and it selects again. No prompt is sent.',
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
      : signerContext
        ? `${signerContext.napplet.dTag} requests publication to the configured relays.`
        : 'A Paja host operation will send this event to the configured relay set.',
    details: confirmationDetails(
      signerContext
        ? `Napplet: ${signerContext.napplet.dTag} (${signerContext.windowId})`
        : undefined,
      signerContext ? `Version: ${signerContext.napplet.aggregateHash}` : undefined,
      signerContext ? `Approval scope: ${signerContext.runtimeScope}` : undefined,
      signerContext?.runtimeScope.startsWith('target-url:')
        ? `Target URL: ${signerContext.runtimeScope.slice('target-url:'.length)}`
        : undefined,
      signerContext ? `Signer: ${signerContext.signerPubkey === 'host-generated' ? 'Host-generated events (this Paja session)' : signerContext.signerPubkey}` : undefined,
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
  if (request.action === 'llm' || request.action === 'llm-configure') {
    // Prompt content and credentials are never logged; counts and the route are enough to audit consent.
    appendPajaMessageLog(state, 'paja', {
      type: `paja.${request.action}.${allowed ? 'confirmed' : 'denied'}`,
      windowId: request.windowId,
      dTag: request.napplet.dTag,
      aggregateHash: request.napplet.aggregateHash,
      ...(request.action === 'llm'
        ? { connection: request.connection, model: request.model, route: request.route, messages: request.messages, images: request.images, format: request.format }
        : { requirements: request.requirements }),
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
