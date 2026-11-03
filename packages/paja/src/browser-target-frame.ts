import {
  assertNappletHasNoFrame,
  denyNappletControllerAccess,
  hasNappletFramePolicy,
  injectNappletNamespacePrelude,
  prepareNappletSrcdoc,
  originRegistry,
  resolveShellEnvironment,
  type OriginIdentity,
  type ShellAdapter,
  type SessionEntry,
} from '@kehto/shell';

import { isPajaLocalTarget, type PajaRuntimeTarget } from './local-target.js';
import type { PajaHostConfig, PajaNestedContextLockSetting } from './options.js';
import { readStoredNestedContextLockSetting } from './browser-security-settings.js';
import type { PajaShellEnvironment } from './parity.js';

/**
 * Resolve Paja's one authoritative environment from a trusted frame identity.
 * The caller persists this exact snapshot with the frame registration so its
 * prelude and later shell.init cannot drift when host policy changes.
 */
export function resolvePajaFrameEnvironment(
  hooks: ShellAdapter,
  identity: OriginIdentity,
): PajaShellEnvironment {
  if (typeof identity.dTag !== 'string' || !identity.aggregateHash) {
    throw new Error('Paja frame identity requires a dTag and aggregate hash');
  }
  return resolveShellEnvironment(hooks, identity);
}

export function getTargetIdentity(
  config: PajaHostConfig,
  resolvedTarget?: PajaRuntimeTarget | null,
): Pick<SessionEntry, 'pubkey' | 'dTag' | 'aggregateHash'> {
  return {
    pubkey: '',
    dTag: resolvedTarget?.dTag ?? config.window.dTag,
    aggregateHash: resolvedTarget?.aggregateHash ?? config.window.aggregateHash,
  };
}

/** Build the immutable origin identity assigned before a Paja frame executes. */
export function getTargetOriginIdentity(
  config: PajaHostConfig,
  resolvedTarget?: PajaRuntimeTarget | null,
): OriginIdentity {
  const target = getTargetIdentity(config, resolvedTarget);
  return Object.freeze({ dTag: target.dTag, aggregateHash: target.aggregateHash });
}

export function registerFrameForGeneration(
  frame: HTMLIFrameElement,
  config: PajaHostConfig,
  generation: number,
  identity: OriginIdentity,
  environment: PajaShellEnvironment,
  windowId = `${config.window.id}:${generation}`,
): string | null {
  const win = frame.contentWindow;
  if (!win) return null;
  originRegistry.register(win, windowId, identity);
  originRegistry.setEnvironment(win, environment);
  return windowId;
}

/**
 * Return a frame that has never hosted a napplet document. NIP-5D binds
 * identity to one document's `napplet.hello` port and forbids re-binding an
 * identity to an existing iframe, so a frame that was registered (or whose
 * Window is spent) is replaced in the DOM by an attribute-identical clone.
 *
 * @param frame - The current napplet iframe
 * @returns `frame` when unused, otherwise the fresh replacement
 */
export function ensureFreshNappletFrame(frame: HTMLIFrameElement): HTMLIFrameElement {
  const win = frame.contentWindow;
  if (!win || (!originRegistry.isSpent(win) && originRegistry.getWindowId(win) === undefined)) return frame;
  const fresh = frame.cloneNode(false) as HTMLIFrameElement;
  fresh.removeAttribute('src');
  fresh.removeAttribute('srcdoc');
  frame.replaceWith(fresh);
  return fresh;
}

export async function navigateFrame(
  frame: HTMLIFrameElement,
  config: PajaHostConfig,
  generation: number,
  adapter: ShellAdapter,
  resolvedTarget?: PajaRuntimeTarget | null,
  windowId?: string,
  isCurrent?: () => boolean,
  onRegistered?: (windowId: string | null) => void,
): Promise<string | null> {
  denyNappletControllerAccess(frame);
  // Fail closed: without the host page's frame-src lock, a napplet could navigate its frame before its first load,
  // which no NIP-5D replacement evidence can observe.
  if (!hasNappletFramePolicy(frame.ownerDocument)) {
    throw new Error('[paja] The host page has no frame-src lock; refusing to load a napplet whose frame could navigate away from its verified document.');
  }
  const identity = getTargetOriginIdentity(config, resolvedTarget);
  const environment = resolvePajaFrameEnvironment(adapter, identity);
  const domains = environment.capabilities.domains;
  if (config.target.mode === 'runtime-pointer') {
    // Verified pointers and local development files share this branch: the
    // same pre-execution registration, CSP, prelude, and sandboxed srcdoc.
    if (!resolvedTarget) {
      frame.removeAttribute('src');
      frame.srcdoc = '<!doctype html><html><body></body></html>';
      return null;
    }
    if (isCurrent && !isCurrent()) return null;
    // Unsigned local files have no verified manifest; their HTML metadata is not admission policy.
    if (!isPajaLocalTarget(resolvedTarget)) {
      const missing = resolvedTarget.manifest.requires.filter((domain) => domain !== 'shell' && !domains.includes(domain));
      if (missing.length > 0) {
        // NIP-5D permits warning for missing R domains. O declarations never
        // gate loading; neither declaration changes the exposed namespace.
        console.warn(`[paja] Napplet requires unsupported NAP capabilities: ${missing.join(', ')}; full functionality may be unavailable.`);
      }
    }
    // Resolve the experimental nested-browsing-context lock (opt-in) for this
    // napplet. Precedence: a per-origin host-GUI override wins, else the
    // serialized host config (CLI / config file), else `auto`. `on`/`off` are
    // explicit; `auto` applies the lock only to a napplet granted a
    // privacy-sensitive NAP domain, where exfiltration by an untrusted app has
    // real consequences. See docs/policies/EXPERIMENTAL.md.
    const lockSetting = readStoredNestedContextLockSetting()
      ?? config.experimental?.nestedContextLock
      ?? 'auto';
    const nestedContextLock = resolveNestedContextLock(lockSetting, domains);
    // When locked: reject a napplet whose own markup declares a nested browsing
    // context before it becomes a document. The prelude's Trusted Types policy
    // and factory pins close every scripted iframe path, but static `<iframe>`
    // is instantiated by the parser, which is not a Trusted Types sink. This
    // scan runs in the trusted shell realm, so a napplet cannot bypass it
    // (docs/policies/NIP-5D-CONFORMANCE.md, "Nested browsing contexts").
    if (nestedContextLock) {
      assertNappletHasNoFrame(resolvedTarget.indexHtml);
    }
    // Validate host policy before rebinding an existing window to a new identity.
    const srcdoc = prepareNappletSrcdoc(resolvedTarget.indexHtml, {
      domains,
      ...(nestedContextLock ? { experimental: { nestedContextLock: true } } : {}),
      csp: {
        ...config.csp,
        connectOrigins: [
          ...connectOrigins([...resolvedTarget.relays, ...resolvedTarget.blossomServers]),
          ...(config.csp?.connectOrigins ?? []),
        ],
      },
    });
    const registeredWindowId = registerFrameForGeneration(frame, config, generation, identity, environment, windowId);
    onRegistered?.(registeredWindowId);
    frame.removeAttribute('src');
    frame.srcdoc = srcdoc;
    return registeredWindowId;
  }
  const html = await fetchTargetHtml();
  if (isCurrent && !isCurrent()) return null;
  const registeredWindowId = registerFrameForGeneration(frame, config, generation, identity, environment, windowId);
  onRegistered?.(registeredWindowId);
  frame.removeAttribute('src');
  frame.srcdoc = injectNappletNamespacePrelude(
    injectBaseHref(html, config.target.url),
    { domains },
  );
  return registeredWindowId;
}

/**
 * NAP domains whose data is private enough that an untrusted napplet exfiltrating
 * it has real consequences. Under `auto`, granting one of these turns the
 * nested-browsing-context lock on. NAP-DM exposes decrypted direct messages.
 */
const PRIVACY_SENSITIVE_DOMAINS: ReadonlySet<string> = new Set(['dm']);

/**
 * Resolve the dev-facing nested-context-lock setting to a boolean for one
 * napplet. `on`/`off` are explicit; `auto` locks only when the napplet is
 * granted a privacy-sensitive domain.
 *
 * @param setting - The dev's `on` | `off` | `auto` choice.
 * @param grantedDomains - NAP domains the shell exposes to this napplet.
 * @returns Whether to apply the lock to this napplet.
 */
export function resolveNestedContextLock(
  setting: PajaNestedContextLockSetting,
  grantedDomains: readonly string[],
): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return grantedDomains.some((domain) => PRIVACY_SENSITIVE_DOMAINS.has(domain));
}

export function renderTargetErrorHtml(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `<!doctype html><html><body><pre>${escapeHtml(message)}</pre></body></html>`;
}

function connectOrigins(urls: readonly string[]): string[] {
  const out = new Set<string>();
  for (const value of urls) {
    try {
      const url = new URL(value);
      if (['https:', 'http:', 'wss:', 'ws:'].includes(url.protocol)) out.add(url.origin);
    } catch {
      // Ignore malformed origin hints; the resolver already validates fetches.
    }
  }
  return [...out];
}

async function fetchTargetHtml(): Promise<string> {
  const response = await fetch(new URL('./__kehto/target.html', window.location.href), {
    cache: 'no-store',
    headers: {
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`Paja target fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function injectBaseHref(html: string, targetUrl: string): string {
  const base = `<base href="${escapeAttribute(targetUrl)}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}${base}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (open) => `${open}<head>${base}</head>`);
  }
  return `${base}${html}`;
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
