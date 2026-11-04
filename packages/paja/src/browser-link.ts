import type { LinkOpenContext } from '@kehto/services';
import type { PajaConfirmationHandler, PajaIdentityProvider } from './browser-adapter.js';
import type { PajaConfirmationRequest } from './browser-confirmation-request.js';
import type { PajaUserActivationHandler } from './browser-device-services.js';

/** Resolve one LINK handoff against the current source after host confirmation. */
export async function confirmPajaExternalLink(
  context: LinkOpenContext,
  confirm: PajaConfirmationHandler,
  getIdentity: PajaIdentityProvider | undefined,
  open: (url: URL) => boolean,
  userActivation?: PajaUserActivationHandler,
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
  try {
    const opened = userActivation
      ? await userActivation.run(request, openCurrent)
      : await confirm(request) && openCurrent();
    return { status: opened ? 'opened' : 'denied' };
  } catch { return { status: 'denied' }; }
}
