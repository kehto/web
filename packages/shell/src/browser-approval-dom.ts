/** Create an element with optional text and class, without touching innerHTML. */
export function element<K extends keyof HTMLElementTagNameMap>(
  document: Document, tag: K, text?: string, className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/** Create a labelled choice list whose value is one of the given options. */
export function select<T extends string>(
  document: Document, label: string, options: ReadonlyArray<readonly [value: T, text: string]>, value: T,
): HTMLSelectElement {
  const node = element(document, 'select');
  node.setAttribute('aria-label', label);
  for (const [optionValue, text] of options) {
    const option = element(document, 'option', text);
    option.value = optionValue;
    node.append(option);
  }
  node.value = value;
  return node;
}
