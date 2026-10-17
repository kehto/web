import type { LinkOpenContext } from '@kehto/services';
import type { PajaConfirmationHandler, PajaIdentityProvider } from './browser-adapter.js';

/** Resolve one LINK handoff against the current source after host confirmation. */
export async function confirmPajaExternalLink(
  context: LinkOpenContext,
  confirm: PajaConfirmationHandler,
  getIdentity: PajaIdentityProvider | undefined,
  open: (url: URL) => boolean,
): Promise<{ status: 'opened' | 'denied' }> {
  const { windowId, url, options, signal } = context;
  if (signal?.aborted) return { status: 'denied' };
  const identity = getIdentity?.(windowId) ?? { dTag: 'dev-target', aggregateHash: 'paja' };
  const allowed = await confirm({ action: 'link', windowId, napplet: identity, url: url.href,
    ...(options?.label ? { label: options.label.slice(0, 256) } : {}) });
  const current = getIdentity?.(windowId) ?? { dTag: 'dev-target', aggregateHash: 'paja' };
  if (!allowed || signal?.aborted || current.dTag !== identity.dTag
    || current.aggregateHash !== identity.aggregateHash) return { status: 'denied' };
  return { status: open(url) ? 'opened' : 'denied' };
}
