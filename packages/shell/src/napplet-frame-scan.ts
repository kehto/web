/**
 * Host-side scan that rejects verified napplet bytes whose own markup contains a
 * nested browsing context (iframe/frame/frameset/object/embed/portal/fencedframe).
 *
 * The prelude's Trusted Types policy and factory pins close every *scripted*
 * iframe-creation path, but a napplet's own static `<iframe>` is instantiated by
 * the HTML parser, which is not a Trusted Types sink. This scan runs in the
 * trusted shell realm, before the bytes become a document, so a napplet cannot
 * influence or bypass it. Reject here and the frame never exists.
 *
 * @see docs/policies/NIP-5D-CONFORMANCE.md — "Nested browsing contexts"
 */

/** Frame element local names that create a nested browsing context. */
const FRAME_ELEMENTS = new Set([
  'iframe', 'frame', 'frameset', 'object', 'embed', 'portal', 'fencedframe',
]);

/** Lexical backstop: a frame tag as a complete tag-name token (open or close). */
const FRAME_TAG = /<\/?(?:iframe|frame|frameset|object|embed|portal|fencedframe)(?=[\s/>]|$)/i;

type ParserHost = {
  DOMParser?: new () => { parseFromString: (input: string, type: string) => Document };
};

/**
 * Walk a parsed subtree (including `<template>` content and shadow roots) for a
 * frame element in the HTML namespace.
 */
function subtreeHasFrame(root: ParentNode): boolean {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    const local = (element.localName || '').toLowerCase();
    if (element.namespaceURI === 'http://www.w3.org/1999/xhtml' && FRAME_ELEMENTS.has(local)) {
      return true;
    }
    const template = element as HTMLTemplateElement;
    if (local === 'template' && template.content && subtreeHasFrame(template.content)) return true;
    if (element.shadowRoot && subtreeHasFrame(element.shadowRoot)) return true;
  }
  return false;
}

/**
 * Report whether verified napplet HTML would instantiate a nested browsing
 * context. Parses with the host's own `DOMParser` (a superset of what the live
 * sandboxed parser instantiates) when present, and always applies a lexical
 * frame-tag backstop so the check is conservative without a DOM.
 *
 * @param html - Already-verified napplet artifact HTML.
 * @returns `true` if a frame element is present and the bytes must be rejected.
 * @example
 * ```ts
 * if (nappletMarkupHasFrame(verifiedHtml)) throw new Error('napplet declares a frame');
 * ```
 */
export function nappletMarkupHasFrame(html: string): boolean {
  if (typeof html !== 'string') return false;
  const DOMParser = (globalThis as ParserHost).DOMParser;
  if (DOMParser) {
    // Accurate path (production hosts run in a browser): the parser instantiates
    // only real elements, so a frame tag inside a comment, attribute or script
    // string is correctly not flagged. The DOMParser result is a superset of
    // what the live sandboxed parser instantiates (verified in Chromium,
    // Firefox and WebKit), so a frame it misses cannot load either.
    try {
      return subtreeHasFrame(new DOMParser().parseFromString(html, 'text/html'));
    } catch {
      // Fall through to the conservative lexical backstop.
    }
  }
  // Conservative fallback for a host without a parser (e.g. a non-browser
  // runtime): match a frame tag token anywhere, which may over-reject markup
  // that merely mentions a frame tag in a comment or string. Production hosts
  // take the accurate path above.
  return FRAME_TAG.test(html);
}

/**
 * Throw if verified napplet HTML would instantiate a nested browsing context.
 * Call before assigning the srcdoc of a verified napplet.
 *
 * @param html - Already-verified napplet artifact HTML.
 * @throws If the markup contains a frame element.
 * @example
 * ```ts
 * assertNappletHasNoFrame(verifiedHtml);
 * iframe.srcdoc = prepareNappletSrcdoc(verifiedHtml, { domains });
 * ```
 */
export function assertNappletHasNoFrame(html: string): void {
  if (nappletMarkupHasFrame(html)) {
    throw new Error(
      'kehto: napplet markup declares a nested browsing context (iframe/frame/object/embed); rejected before load',
    );
  }
}
