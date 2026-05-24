export function trustedHtmlFragment(target: Node, html: string): DocumentFragment {
  const range = target.ownerDocument.createRange();
  return range.createContextualFragment(html);
}

export function replaceChildrenFromTrustedHtml(target: Element | ShadowRoot, html: string): void {
  target.replaceChildren(trustedHtmlFragment(target, html));
}
