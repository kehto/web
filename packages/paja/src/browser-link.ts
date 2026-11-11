import type { LinkOpenContext } from '@kehto/services';
import type { PajaConfirmationHandler, PajaIdentityProvider } from './browser-adapter.js';
import type { PajaConfirmationRequest } from './browser-confirmation-request.js';
import type { PajaUserActivationHandler } from './browser-device-services.js';

/** Whether a click is still fresh enough for the browser to permit a new tab. */
function hasBrowserActivation(): boolean {
  return typeof navigator !== 'undefined'
    && (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive === true;
}

/**
 * Resolve one LINK handoff against the current source. A link the Firewall
 * approved opens straight from the click that approved it; the confirmation
 * dialog appears only when no click is available to open a tab from, such as a
 * link allowed by a standing rule, or when no Firewall approval ran at all.
 */
export async function confirmPajaExternalLink(
  context: LinkOpenContext,
  confirm: PajaConfirmationHandler,
  getIdentity: PajaIdentityProvider | undefined,
  open: (url: URL) => boolean,
  userActivation?: PajaUserActivationHandler,
  isActivated: () => boolean = hasBrowserActivation,
): Promise<{ status: 'opened' | 'denied' }> {
  const { windowId, url, options, signal } = context;
  if (signal?.aborted) return { status: 'denied' };
  const fallback: ReturnType<PajaIdentityProvider> = { dTag: 'dev-target', aggregateHash: 'paja' };
  const identity = getIdentity?.(windowId) ?? fallback;
  const isCurrent = (): boolean => {
    const current = getIdentity?.(windowId) ?? fallback;
    return !signal?.aborted && (identity.isCurrent?.() ?? true)
      && current.dTag === identity.dTag && current.aggregateHash === identity.aggregateHash;
  };
  const request: PajaConfirmationRequest = { action: 'link', windowId, napplet: identity, url: url.href,
    ...(options?.label ? { label: options.label.slice(0, 256) } : {}), isCurrent };
  const openCurrent = (): boolean => isCurrent() && open(url);
  // `signal` exists only when the runtime Firewall authorized this exact URL.
  if (signal && isActivated() && openCurrent()) return { status: 'opened' };
  try {
    const opened = userActivation
      ? await userActivation.run(request, openCurrent)
      : await confirm(request) && openCurrent();
    return { status: opened ? 'opened' : 'denied' };
  } catch { return { status: 'denied' }; }
}
