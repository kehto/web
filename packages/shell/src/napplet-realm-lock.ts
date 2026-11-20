/**
 * Opt-in realm locks the namespace prelude installs before any napplet script runs (Kehto experimental namespace,
 * docs/policies/EXPERIMENTAL.md). Each lock is a self-contained function: the prelude serializes it into the
 * `srcdoc`, so no lock may reference anything outside its own body.
 *
 * Both locks share the realm's single Trusted Types `default` policy. Each lock pushes an HTML guard; one installer
 * registers the policy and runs every guard on every string sink.
 *
 * @see docs/policies/NIP-5D-CONFORMANCE.md — "Nested browsing contexts" and "Resource hints"
 */

import type { NappletExperimentalOptions } from './napplet-experimental.js';

/** Returns a rejection message for a string headed to a DOM sink, or null to let it through. */
type HtmlGuard = (input: string, sink: string) => string | null;

/** Returns a rejection message for an element found in a parsed document, or null. */
type ElementGuard = (element: Element) => string | null;

/** A window exposing the optional members the locks pin or install. */
type LockWindow = Window & {
  trustedTypes?: {
    createPolicy: (
      name: string,
      rules: {
        createHTML: (input: string, ...rest: unknown[]) => string;
        createScript: (input: string) => string;
        createScriptURL: (input: string) => string;
      },
    ) => unknown;
  };
  Document?: { prototype: Document };
  DOMImplementation?: { prototype: DOMImplementation };
  DOMParser?: { prototype: DOMParser };
  HTMLLinkElement?: typeof HTMLLinkElement;
  DOMTokenList?: { prototype: DOMTokenList };
  Element?: { prototype: Element };
  NamedNodeMap?: { prototype: NamedNodeMap };
  Attr?: typeof Attr;
  Node?: { prototype: Node };
};

/**
 * Whether the experimental options need the Trusted Types CSP directives.
 *
 * @param experimental - The resolved experimental options for one napplet
 * @returns True when any realm lock is on
 * @example
 * ```ts
 * const csp = needsTrustedTypes(options.experimental) ? `${base}; ${TRUSTED_TYPES_DIRECTIVES}` : base;
 * ```
 */
export function needsTrustedTypes(experimental: NappletExperimentalOptions | undefined): boolean {
  return experimental?.nestedContextLock === true || experimental?.resourceHintLock === true;
}

/**
 * Render the serialized realm-lock function the prelude calls with the napplet `window`. With no lock on, it is a
 * no-op, so the realm stays exactly as it was before these policies existed.
 *
 * @param experimental - The resolved experimental options for one napplet
 * @returns JavaScript source of a function taking the napplet `window`
 * @example
 * ```ts
 * const source = renderNappletRealmLock({ nestedContextLock: true });
 * ```
 */
export function renderNappletRealmLock(experimental: NappletExperimentalOptions | undefined): string {
  const parts = [
    experimental?.nestedContextLock === true ? nappletFrameLock.toString() : null,
    experimental?.resourceHintLock === true ? nappletHintLock.toString() : null,
  ].filter((part): part is string => part !== null);
  if (!parts.length) return '(function(){})';
  const calls = parts.map((part) => `(${part})(win, guards, elementGuards);`).join('');
  return `(function(win){var guards=[],elementGuards=[];${calls}(${installDefaultPolicy.toString()})(win, guards, elementGuards);})`;
}

/**
 * Register the one Trusted Types `default` policy (admitted by the napplet CSP's `trusted-types default`) and run
 * every guard on every string sink. Canonical HTML passes through untouched. A nested sink call made while a guard
 * parses its input passes through: the outer call already checks the whole string.
 */
function installDefaultPolicy(win: LockWindow, guards: HtmlGuard[], elementGuards: ElementGuard[]): void {
  // DOMParser's XML modes expand DTD internal entities, so markup can arrive as character references that no string
  // check sees (`<!ENTITY e "&#60;h:iframe …/&#62;">`, measured minting a frame and a hint link in Chromium 147,
  // Firefox 148 and WebKit 26.4). Check the parsed result instead, template content and shadow roots included.
  const parserProto = win.DOMParser?.prototype;
  if (parserProto && elementGuards.length) {
    const parse = parserProto.parseFromString;
    const inspect = (root: ParentNode): string | null => {
      for (const element of root.querySelectorAll('*')) {
        for (const guard of elementGuards) {
          const rejection = guard(element);
          if (rejection) return rejection;
        }
        const nested = (element as HTMLTemplateElement).content ?? element.shadowRoot;
        const rejection = nested ? inspect(nested) : null;
        if (rejection) return rejection;
      }
      return null;
    };
    try {
      Object.defineProperty(parserProto, 'parseFromString', {
        value(this: DOMParser, ...args: unknown[]) {
          const parsed = (parse as (...inner: unknown[]) => Document).apply(this, args);
          const rejection = inspect(parsed);
          if (rejection) throw new TypeError(rejection);
          return parsed;
        },
        writable: false, configurable: false, enumerable: false,
      });
    } catch {
      // Never turn hardening into a load-blocking failure.
    }
  }
  const { trustedTypes } = win;
  if (!trustedTypes) return;
  let busy = false;
  try {
    trustedTypes.createPolicy('default', {
      createHTML: (input, ...rest): string => {
        if (busy) return input;
        const sink = rest.length >= 2 ? String(rest[1]) : '';
        busy = true;
        try {
          for (const guard of guards) {
            const rejection = guard(input, sink);
            if (rejection) throw new TypeError(rejection);
          }
        } finally {
          busy = false;
        }
        return input;
      },
      createScript: (input): string => input,
      createScriptURL: (input): string => input,
    });
  } catch {
    // The prelude runs before napplet code, so nothing else can hold `default`; the pins and host scans still hold.
  }
}

/**
 * Close every way an iframe element can be minted in a napplet realm.
 *
 * 1. HTML string sinks: the shared `default` policy rejects any string carrying a frame tag.
 * 2. Element factories: `createElement` / `createElementNS` / `createDocument` are pinned non-configurable to
 *    reject frame tag names.
 * 3. XSLT: `XSLTProcessor.transformToFragment` builds elements from an XSL DOM without any factory or string sink
 *    (measured minting an iframe under this lock in Chromium 147, Firefox 148 and WebKit 26.4), so the constructor
 *    is removed from the realm. Namespace-prefixed frame tags, which DOMParser's XML modes make live, are matched
 *    by the string-sink guard, and every `DOMParser` result is inspected for XHTML frame elements (DTD entities hide
 *    markup from any string check).
 *
 * Node movement needs a pre-existing frame node (all routes closed), and escaping the pins needs a fresh realm
 * (child frame closed here, popup denied by the sandbox, worker has no DOM).
 */
function nappletFrameLock(win: LockWindow, guards: HtmlGuard[], elementGuards: ElementGuard[]): void {
  const FRAME_ELEMENTS = new Set([
    'iframe', 'frame', 'frameset', 'object', 'embed', 'portal', 'fencedframe',
  ]);
  const message = 'kehto: napplets may not create nested browsing contexts';
  const isFrameTag = (value: unknown): boolean => FRAME_ELEMENTS.has(String(value).toLowerCase());
  // A complete frame tag-name token (open or close), so a lexical check cannot be split by parse-context
  // differences, plus a chunk that ends mid-tag (a streaming document.write frame-tag prefix). An optional
  // namespace prefix is matched too: DOMParser's XML modes turn `<h:iframe xmlns:h="…xhtml">` into a live XHTML
  // iframe once adopted (measured in Chromium 147, Firefox 148 and WebKit 26.4).
  const FRAME_TAG = /<\/?(?:[^\s/>:!?]+:)?(?:iframe|frame|frameset|object|embed|portal|fencedframe)(?=[\s/>]|$)/i;
  const FRAME_TAG_PREFIX = /<[\w:.-]*$/;
  guards.push((input, sink) => {
    const blocked = /write/i.test(sink) ? FRAME_TAG.test(input) || FRAME_TAG_PREFIX.test(input) : FRAME_TAG.test(input);
    return blocked ? message : null;
  });
  const XHTML = 'http://www.w3.org/1999/xhtml';
  elementGuards.push((element) => (element.namespaceURI === XHTML && isFrameTag(element.localName) ? message : null));

  const pin = (object: object, name: string, value: unknown): void => {
    try {
      Object.defineProperty(object, name, { value, writable: false, configurable: false, enumerable: false });
    } catch {
      // Never turn hardening into a load-blocking failure.
    }
  };
  pin(win, 'XSLTProcessor', undefined);
  const localName = (qualified: unknown): string => String(qualified ?? '').split(':').pop()!.toLowerCase();
  const HTML_NS = 'http://www.w3.org/1999/xhtml';

  const docProto = win.Document?.prototype;
  if (docProto) {
    const createElement = docProto.createElement;
    pin(docProto, 'createElement', function (this: Document, tagName: unknown, ...rest: unknown[]) {
      if (isFrameTag(tagName)) throw new TypeError(message);
      return (createElement as (...args: unknown[]) => unknown).call(this, tagName, ...rest);
    });
    const createElementNS = docProto.createElementNS;
    pin(docProto, 'createElementNS', function (this: Document, namespace: unknown, qualifiedName: unknown, ...rest: unknown[]) {
      if (namespace === HTML_NS && FRAME_ELEMENTS.has(localName(qualifiedName))) throw new TypeError(message);
      return (createElementNS as (...args: unknown[]) => unknown).call(this, namespace, qualifiedName, ...rest);
    });
  }

  const domImpl = win.DOMImplementation?.prototype;
  if (domImpl) {
    const createDocument = domImpl.createDocument;
    pin(domImpl, 'createDocument', function (this: DOMImplementation, namespace: unknown, qualifiedName: unknown, ...rest: unknown[]) {
      if (namespace === HTML_NS && FRAME_ELEMENTS.has(localName(qualifiedName))) throw new TypeError(message);
      return (createDocument as (...args: unknown[]) => unknown).call(this, namespace, qualifiedName, ...rest);
    });
  }
}

/**
 * Close every way a napplet can give a `<link>` the `dns-prefetch`, `preconnect` or `prerender` relation. Browsers
 * act on these hints outside the napplet CSP: measured under Kehto's CSP, Chromium 147 sends a `rel=prerender` GET
 * and resolves and connects for `dns-prefetch` / `preconnect` (network prediction on), Firefox 148 resolves
 * `dns-prefetch`, and WebKit 26.4 connects for `preconnect`. Each carries napplet-chosen data in the URL or host.
 *
 * 1. HTML string sinks: the shared `default` policy parses the string in an inert document and rejects it when a
 *    `<link>` would carry a hint relation; a `document.write` chunk that ends inside a tag is rejected too, so a
 *    hint cannot be split across chunks.
 * 2. Attribute paths: the `rel` setter, `relList` token edits, `setAttribute(NS)`, `setAttributeNode(NS)`,
 *    `NamedNodeMap.setNamedItem(NS)` and `Attr` value writes are pinned to reject a hint token on `rel`.
 * 3. XSLT is removed, as in the frame lock. Static hints in the verified bytes are refused by the host before load
 *    (`assertNappletHasNoResourceHint`): a script can rewrite a static hint's `href` into a data channel.
 */
function nappletHintLock(win: LockWindow, guards: HtmlGuard[], elementGuards: ElementGuard[]): void {
  const message = 'kehto: napplets may not add dns-prefetch, preconnect or prerender hints';
  const HINTS = new Set(['dns-prefetch', 'preconnect', 'prerender']);
  const hasHint = (value: unknown): boolean => String(value ?? '').toLowerCase().split(/[\t\n\f\r ]+/).some((token) => HINTS.has(token));
  const reject = (): never => { throw new TypeError(message); };
  const LinkElement = win.HTMLLinkElement;
  const isLink = (node: unknown): boolean => !!LinkElement && node instanceof LinkElement;
  const isRel = (name: unknown): boolean => String(name ?? '').split(':').pop()!.toLowerCase() === 'rel';

  elementGuards.push((element) => (element.namespaceURI === 'http://www.w3.org/1999/xhtml' && element.localName === 'link'
    && hasHint(element.getAttribute('rel')) ? message : null));
  const inert = win.document.implementation.createHTMLDocument('');
  guards.push((input, sink) => {
    if (/write/i.test(sink) && /<[^>]*$/.test(input)) return message;
    // A prefixed link is an XHTML link once DOMParser parses the string as XML and the node is adopted; the HTML
    // parse below would only see an unknown `h:link` element.
    if (/<[^\s/>:!?]+:link(?=[\s/>]|$)/i.test(input)) return message;
    const template = inert.createElement('template');
    template.innerHTML = input;
    // Descend into nested <template> content: cloning it out later makes its links live without any setter.
    const fragments: ParentNode[] = [template.content];
    while (fragments.length) {
      const root = fragments.pop()!;
      for (const element of root.querySelectorAll('link, template')) {
        if (element.localName === 'template') fragments.push((element as HTMLTemplateElement).content);
        else if (hasHint(element.getAttribute('rel'))) return message;
      }
    }
    return null;
  });

  const define = (object: object | undefined, name: string, descriptor: PropertyDescriptor): void => {
    if (!object) return;
    try {
      Object.defineProperty(object, name, { ...descriptor, configurable: false, enumerable: false });
    } catch {
      // Never turn hardening into a load-blocking failure.
    }
  };
  const accessor = (object: object | undefined, name: string): PropertyDescriptor | undefined =>
    object ? Object.getOwnPropertyDescriptor(object, name) : undefined;
  define(win, 'XSLTProcessor', { value: undefined, writable: false });

  const linkProto = LinkElement?.prototype;
  const rel = accessor(linkProto, 'rel');
  if (rel?.set) {
    define(linkProto, 'rel', { get: rel.get, set(this: HTMLLinkElement, value: unknown) { if (hasHint(value)) reject(); rel.set!.call(this, value); } });
  }
  const linkLists = new WeakSet<object>();
  const relList = accessor(linkProto, 'relList');
  if (relList?.get) {
    define(linkProto, 'relList', {
      get(this: HTMLLinkElement) { const list = relList.get!.call(this) as object; linkLists.add(list); return list; },
      set: relList.set,
    });
  }
  const tokenProto = win.DOMTokenList?.prototype;
  for (const method of ['add', 'toggle', 'replace'] as const) {
    const original = tokenProto?.[method] as ((...args: unknown[]) => unknown) | undefined;
    if (!tokenProto || !original) continue;
    define(tokenProto, method, {
      writable: false,
      value(this: DOMTokenList, ...tokens: unknown[]) {
        const added = method === 'replace' ? tokens.slice(1) : method === 'toggle' ? tokens.slice(0, 1) : tokens;
        if (linkLists.has(this) && added.some(hasHint)) reject();
        return original.apply(this, tokens);
      },
    });
  }
  const tokenValue = accessor(tokenProto, 'value');
  if (tokenProto && tokenValue?.set) {
    define(tokenProto, 'value', { get: tokenValue.get, set(this: DOMTokenList, value: unknown) { if (linkLists.has(this) && hasHint(value)) reject(); tokenValue.set!.call(this, value); } });
  }

  const elementProto = win.Element?.prototype;
  const wrapMethod = (object: object | undefined, name: string, check: (self: unknown, args: unknown[]) => boolean): void => {
    const original = object ? (object as Record<string, unknown>)[name] as ((...args: unknown[]) => unknown) | undefined : undefined;
    if (!object || typeof original !== 'function') return;
    define(object, name, { writable: false, value(this: unknown, ...args: unknown[]) { if (check(this, args)) reject(); return original.apply(this, args); } });
  };
  wrapMethod(elementProto, 'setAttribute', (self, [name, value]) => isLink(self) && isRel(name) && hasHint(value));
  wrapMethod(elementProto, 'setAttributeNS', (self, [, name, value]) => isLink(self) && isRel(name) && hasHint(value));
  const hintAttr = (attr: unknown): boolean => {
    const node = attr as Partial<Attr> | null;
    return !!node && isRel(node.localName ?? node.name) && hasHint(node.value);
  };
  for (const name of ['setAttributeNode', 'setAttributeNodeNS']) wrapMethod(elementProto, name, (self, [attr]) => isLink(self) && hintAttr(attr));
  for (const name of ['setNamedItem', 'setNamedItemNS']) wrapMethod(win.NamedNodeMap?.prototype, name, (_self, [attr]) => hintAttr(attr));

  const AttrType = win.Attr;
  const guardsAttr = (self: unknown, value: unknown): boolean => {
    if (!AttrType || !(self instanceof AttrType)) return false;
    return isRel(self.localName) && hasHint(value) && (self.ownerElement === null || isLink(self.ownerElement));
  };
  for (const [object, name] of [[AttrType?.prototype, 'value'], [win.Node?.prototype, 'nodeValue'], [win.Node?.prototype, 'textContent']] as const) {
    const original = accessor(object, name);
    if (!original?.set) continue;
    define(object, name, { get: original.get, set(this: unknown, value: unknown) { if (guardsAttr(this, value)) reject(); original.set!.call(this, value); } });
  }
}
