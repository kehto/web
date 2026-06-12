export function trustedHtmlFragment(target: Node, html: string): DocumentFragment {
  const ownerDocument = target.ownerDocument ?? document;
  const range = ownerDocument.createRange();
  return range.createContextualFragment(html);
}

export function replaceChildrenFromTrustedHtml(target: Element | ShadowRoot, html: string): void {
  target.replaceChildren(trustedHtmlFragment(target, html));
}
