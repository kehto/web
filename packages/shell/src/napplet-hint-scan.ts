/**
 * Host-side scan that rejects verified napplet bytes whose own markup carries a `dns-prefetch`, `preconnect` or
 * `prerender` link. The resource-hint lock closes every scripted way to add one, but the HTML parser instantiates a
 * static `<link>` without any script hook, and a script can then rewrite that link's `href` into a data channel
 * (measured in Chromium 147 and WebKit 26.4). This scan runs in the trusted shell realm before the bytes become a
 * document.
 *
 * @see docs/policies/NIP-5D-CONFORMANCE.md — "Resource hints"
 */

/** Link relations browsers act on outside the napplet CSP. */
const HINT_RELATIONS = new Set(['dns-prefetch', 'preconnect', 'prerender']);

/** Lexical backstop without a DOM: any link tag naming a hint, or using a character reference that could spell one. */
const HINT_LINK = /<link\b[^>]*(?:dns-prefetch|preconnect|prerender|&)/i;

type ParserHost = {
  DOMParser?: new () => { parseFromString: (input: string, type: string) => Document };
};

function relHasHint(value: string | null): boolean {
  return (value ?? '').toLowerCase().split(/[\t\n\f\r ]+/).some((token) => HINT_RELATIONS.has(token));
}

/** Walk a parsed subtree, `<template>` content and shadow roots included, for a hint link. */
function subtreeHasHint(root: ParentNode): boolean {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    const local = (element.localName || '').toLowerCase();
    if (local === 'link' && relHasHint(element.getAttribute('rel'))) return true;
    const template = element as HTMLTemplateElement;
    if (local === 'template' && template.content && subtreeHasHint(template.content)) return true;
    if (element.shadowRoot && subtreeHasHint(element.shadowRoot)) return true;
  }
  return false;
}

/**
 * Report whether verified napplet HTML declares a `dns-prefetch`, `preconnect` or `prerender` link. Parses with the
 * host's `DOMParser` when present (scripting is off there, so `<noscript>` content counts too), else applies a
 * conservative lexical check.
 *
 * @param html - Already-verified napplet artifact HTML
 * @returns `true` if a hint link is present and the bytes must be rejected
 * @example
 * ```ts
 * if (nappletMarkupHasResourceHint(verifiedHtml)) throw new Error('napplet declares a resource hint');
 * ```
 */
export function nappletMarkupHasResourceHint(html: string): boolean {
  if (typeof html !== 'string') return false;
  const DOMParser = (globalThis as ParserHost).DOMParser;
  if (DOMParser) {
    try {
      return subtreeHasHint(new DOMParser().parseFromString(html, 'text/html'));
    } catch {
      // Fall through to the conservative lexical backstop.
    }
  }
  return HINT_LINK.test(html);
}

/**
 * Throw if verified napplet HTML declares a `dns-prefetch`, `preconnect` or `prerender` link. Call before assigning
 * the srcdoc of a napplet loaded with the resource-hint lock.
 *
 * @param html - Already-verified napplet artifact HTML
 * @throws If the markup contains a hint link
 * @example
 * ```ts
 * assertNappletHasNoResourceHint(verifiedHtml);
 * iframe.srcdoc = prepareNappletSrcdoc(verifiedHtml, { domains, experimental: { resourceHintLock: true } });
 * ```
 */
export function assertNappletHasNoResourceHint(html: string): void {
  if (nappletMarkupHasResourceHint(html)) {
    throw new Error('kehto: napplet markup declares a dns-prefetch, preconnect or prerender link; rejected before load');
  }
}
