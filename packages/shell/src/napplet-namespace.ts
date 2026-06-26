export interface NappletNamespacePreludeOptions {
  /**
   * Bare NAP domain names the shell exposes to this napplet.
   */
  domains: readonly string[];
}

function uniqueBareDomains(domains: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const domain of domains) {
    const value = domain.trim();
    if (!value || value.includes(':') || value.startsWith('perm:') || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Render the host-owned NIP-5D bootstrap that exposes available NAP domains
 * under `window.napplet` before napplet artifact code runs.
 *
 * @param options - Domain availability to inject.
 * @returns An inline script tag suitable for `srcdoc` prelude insertion.
 */
export function renderNappletNamespacePrelude(options: NappletNamespacePreludeOptions): string {
  const domains = uniqueBareDomains(options.domains);
  return `<script data-kehto-nip5d-injection>(${nappletNamespacePrelude.toString()})(${scriptJson(domains)});</script>`;
}

/**
 * Insert the NIP-5D namespace prelude into HTML before authored scripts.
 *
 * @param html - Verified napplet artifact HTML.
 * @param options - Domain availability to inject.
 * @returns HTML with the prelude inside `<head>` when possible.
 */
export function injectNappletNamespacePrelude(
  html: string,
  options: NappletNamespacePreludeOptions,
): string {
  const prelude = renderNappletNamespacePrelude(options);
  const cspMeta = /(<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>)/i;
  if (cspMeta.test(html)) {
    return html.replace(cspMeta, `$1${prelude}`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}${prelude}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (open) => `${open}<head>${prelude}</head>`);
  }
  return `${prelude}${html}`;
}

function nappletNamespacePrelude(domains: string[]): void {
  const target = window as Window & { napplet?: Record<string, unknown> };

  function buildNappletNamespace(value: unknown): Record<string, unknown> {
    const candidate = typeof value === 'object' && value !== null
      ? value as Record<string, unknown>
      : {};
    const next: Record<string, unknown> = {};
    for (const domain of domains) {
      Object.defineProperty(next, domain, {
        value: Object.prototype.hasOwnProperty.call(candidate, domain) ? candidate[domain] : {},
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    if (Object.prototype.hasOwnProperty.call(candidate, 'shell')) {
      Object.defineProperty(next, 'shell', {
        value: candidate.shell,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    Object.defineProperty(next, '__kehtoInjectedDomains', {
      value: Object.freeze([...domains]),
      enumerable: false,
      configurable: true,
      writable: false,
    });
    return next;
  }

  let root = buildNappletNamespace(target.napplet);
  Object.defineProperty(target, 'napplet', {
    get() {
      return root;
    },
    set(value) {
      root = buildNappletNamespace(value);
    },
    enumerable: false,
    configurable: true,
  });
}
