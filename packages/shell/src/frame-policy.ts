/**
 * @kehto/shell -- the embedding-page policy that keeps a napplet frame on its verified document.
 *
 * NIP-5D treats a second `load`, a second `napplet.hello` or the port closing as evidence that the verified document
 * was replaced. None of these can observe a napplet that navigates its frame before its own first `load`: only the
 * replacement fires `load`, and browsers fire no MessagePort `close` event. CSP checks every navigation of a child
 * frame against the embedding page's `frame-src`, including one the frame starts itself, while an unfetched `srcdoc`
 * document still loads. Setting this policy on the host page therefore blocks the replacement outright.
 * This is host page policy, not napplet protocol surface: https://github.com/nostr-protocol/nips/pull/2303
 */

/** The `frame-src` directive a host page sets so napplet frames cannot navigate away from their `srcdoc`. */
export const NAPPLET_FRAME_POLICY = "frame-src 'none'";

/**
 * Render the host-page `<meta>` element carrying {@link NAPPLET_FRAME_POLICY}. Place it in the host page's `<head>`;
 * a `meta` CSP outside `<head>` is ignored. An equivalent HTTP `Content-Security-Policy` header works too.
 *
 * @returns The meta element HTML
 * @example
 * ```ts
 * const head = `<head>${renderNappletFramePolicyMeta()}</head>`;
 * ```
 */
export function renderNappletFramePolicyMeta(): string {
  return `<meta http-equiv="Content-Security-Policy" content="${NAPPLET_FRAME_POLICY}">`;
}

/**
 * Whether a host document carries {@link NAPPLET_FRAME_POLICY} in a `<meta>` CSP. A policy delivered only as an HTTP
 * header is not visible here.
 *
 * @param doc - The host page document
 * @returns True when a CSP meta element contains the directive
 * @example
 * ```ts
 * if (!hasNappletFramePolicy(document)) throw new Error('napplet frames are not navigation-locked');
 * ```
 */
export function hasNappletFramePolicy(doc: Pick<Document, 'querySelectorAll'>): boolean {
  return [...doc.querySelectorAll<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy" i]')]
    .some((meta) => meta.content.split(';').some((directive) => directive.trim() === NAPPLET_FRAME_POLICY));
}
