/**
 * @kehto/shell -- host controls that keep the embedding page URL away from napplet code.
 *
 * A verified napplet loads as an `about:srcdoc` document, which takes two things from the page that embeds it:
 * its referrer and its fallback base URL. Without host policy a napplet reads the shell URL from `document.referrer`
 * (origin-only by default in Chromium and WebKit) and the full URL, path, query and fragment included, from
 * `document.baseURI`. Shell URLs carry state: Paja keeps the opened pointer and intent links in its query. NIP-5D is
 * silent on both (https://github.com/nostr-protocol/nips/pull/2303 at f60550c), so this is beyond-spec Kehto host
 * policy. None of it touches the verified bytes.
 *
 * Measured with sandboxed srcdoc frames in Chromium 147, Firefox 148 and WebKit 26.4:
 * - iframe `referrerpolicy="no-referrer"` empties `document.referrer` in Chromium and Firefox (and masks
 *   `location.ancestorOrigins` in Firefox). WebKit ignores it for srcdoc.
 * - A host page referrer policy (`<meta name="referrer">` or the `Referrer-Policy` header) empties
 *   `document.referrer` in all three.
 * - Only the host page's own base URL reaches `document.baseURI`. A `<base>` injected into the napplet document is
 *   removable by the napplet, which restores the fallback, so the base belongs on the host page.
 * - `location.ancestorOrigins` keeps exposing the host origin in Chromium and WebKit; no host control removes it.
 *
 * @see docs/policies/NIP-5D-CONFORMANCE.md — "Embedding URL"
 */

/** The referrer policy Kehto applies to napplet frames and host pages. */
export const NAPPLET_REFERRER_POLICY = 'no-referrer';

/**
 * Set `referrerpolicy="no-referrer"` on a napplet iframe. Call it before assigning `srcdoc`: the policy applies to
 * the navigation that creates the napplet document. Pair it with {@link renderNappletReferrerPolicyMeta}, because
 * WebKit ignores the attribute for `srcdoc` documents.
 *
 * @param frame - Host-owned iframe, before its napplet document is assigned
 * @returns Nothing
 * @example
 * ```ts
 * denyNappletReferrer(frame);
 * frame.srcdoc = prepareNappletSrcdoc(verifiedHtml, { domains });
 * ```
 */
export function denyNappletReferrer(frame: Pick<HTMLIFrameElement, 'setAttribute'>): void {
  frame.setAttribute('referrerpolicy', NAPPLET_REFERRER_POLICY);
}

/**
 * Render the host-page `<meta>` element that sets {@link NAPPLET_REFERRER_POLICY} for the page and the srcdoc
 * documents it embeds. It also drops the `Referer` header from the host page's own requests.
 *
 * @returns The meta element HTML
 * @example
 * ```ts
 * const head = `<head>${renderNappletReferrerPolicyMeta()}${renderNappletHostBase()}</head>`;
 * ```
 */
export function renderNappletReferrerPolicyMeta(): string {
  return `<meta name="referrer" content="${NAPPLET_REFERRER_POLICY}">`;
}

/**
 * Render a host-page `<base href="./">`. A srcdoc napplet inherits the host page's base URL as `document.baseURI`;
 * this base keeps the directory and drops the file name, query and fragment. Relative URLs that name a path resolve
 * as before; fragment-only (`#x`) and query-only (`?q`) references on the host page resolve against the directory
 * instead, so check the host page for them before adding it. Place it in the host page `<head>` before any relative
 * URL.
 *
 * @returns The base element HTML
 * @example
 * ```ts
 * const head = `<head><meta charset="utf-8">${renderNappletHostBase()}</head>`;
 * ```
 */
export function renderNappletHostBase(): string {
  return '<base href="./">';
}

/**
 * Whether an iframe already carries {@link NAPPLET_REFERRER_POLICY}.
 *
 * @param frame - The napplet iframe
 * @returns True when `referrerpolicy` is `no-referrer`
 * @example
 * ```ts
 * if (!hasNappletReferrerPolicy(frame)) denyNappletReferrer(frame);
 * ```
 */
export function hasNappletReferrerPolicy(frame: Pick<HTMLIFrameElement, 'getAttribute'>): boolean {
  return (frame.getAttribute('referrerpolicy') ?? '').trim().toLowerCase() === NAPPLET_REFERRER_POLICY;
}

/**
 * Whether a host document carries the {@link renderNappletReferrerPolicyMeta} element, the only referrer control
 * WebKit honors for srcdoc napplets. A policy sent only as an HTTP header is not visible here.
 *
 * @param doc - The host page document
 * @returns True when a `<meta name="referrer" content="no-referrer">` is present
 * @example
 * ```ts
 * if (!hasNappletReferrerPolicyMeta(document)) console.warn('add renderNappletReferrerPolicyMeta()');
 * ```
 */
export function hasNappletReferrerPolicyMeta(doc: Pick<Document, 'querySelectorAll'>): boolean {
  return [...doc.querySelectorAll<HTMLMetaElement>('meta[name="referrer" i]')]
    .some((meta) => meta.content.trim().toLowerCase() === NAPPLET_REFERRER_POLICY);
}
