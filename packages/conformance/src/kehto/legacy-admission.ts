/**
 * kehto/legacy-admission.ts — Load a verified probe on a runtime without `permissions`.
 *
 * `admitBrowserDocument` refuses a runtime without the scoped `permissions`
 * coordinator, and the legacy behavioral Firewall gate only runs on such a
 * runtime. So a host that still uses the legacy gate cannot use canonical
 * admission: it binds identity at hello instead. It registers the verified
 * identity and environment on `originRegistry`, and the bridge registers the
 * session from them on the frame's `napplet.hello`. This module does exactly
 * that with exported `@kehto/shell` APIs, for the `catalog/firewall-denial`
 * scoped session only. Identity still comes from the verified bytes, the
 * prelude stays outside them, and the bytes reach the frame through `srcdoc`.
 */
import {
  buildNappletCsp,
  renderNappletCspMeta,
  renderNappletNamespacePrelude,
  type BrowserAdmissionRequest,
  type BrowserAdmissionResult,
} from '@kehto/shell';

/** Put host content first in `<head>`, ahead of every authored element. */
function insertHead(html: string, content: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (!head) throw new Error('probe artifact has no <head>');
  const at = head.index + head[0].length;
  return `${html.slice(0, at)}${content}${html.slice(at)}`;
}

/**
 * Admit a verified probe document the way a legacy-Firewall host does.
 *
 * Takes the same request as `admitBrowserDocument`. The grant is the advertised
 * domains the manifest declares; a required domain the host lacks is denied.
 *
 * @param request - Verified document, identity, interface sets and frame action.
 * @returns A committed source with a retirement handle, or a closed failure.
 * @example
 * ```ts
 * const result = await admitLegacyDocument({ runtime, entry, verifiedHtml, available, required, optional,
 *   remoteSources: [], isCurrentSource: () => frame.isConnected, commit, onRetire });
 * ```
 */
export async function admitLegacyDocument(request: BrowserAdmissionRequest): Promise<BrowserAdmissionResult> {
  const { runtime, entry } = request;
  const missing = request.required.filter((domain) => !request.available.includes(domain));
  if (missing.length) return { status: 'denied', deniedRequired: missing, omittedOptional: [] };
  if (!request.isCurrentSource()) return { status: 'cancelled', deniedRequired: [], omittedOptional: [] };
  const declared = new Set([...request.required, ...request.optional]);
  const domains = request.available.filter((domain) => domain === 'shell' || declared.has(domain));
  const srcdoc = insertHead(request.verifiedHtml, renderNappletCspMeta() + renderNappletNamespacePrelude({ domains }));
  const commit = { windowId: entry.windowId, domains, mode: 'isolated' as const, csp: buildNappletCsp(), omittedOptional: [] };
  let retired = false;
  const retire = (): void => {
    if (retired) return;
    retired = true;
    // The bridge registered this session from the hello; drop it with the frame.
    if (runtime.sessionRegistry.getEntryByWindowId(entry.windowId)) {
      runtime.destroyWindow(entry.windowId);
      runtime.sessionRegistry.unregister(entry.windowId);
    }
    request.onRetire();
  };
  request.commit(srcdoc, commit);
  return { status: 'committed', ...commit, retire };
}
