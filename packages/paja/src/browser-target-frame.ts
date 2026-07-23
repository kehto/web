import {
  injectNappletNamespacePrelude,
  originRegistry,
  resolveShellEnvironment,
  type OriginIdentity,
  type ShellAdapter,
  type SessionEntry,
} from '@kehto/shell';

import type { PajaHostConfig } from './options.js';
import type { PajaShellEnvironment } from './parity.js';
import { injectPajaRuntimeCsp, type PajaResolvedPointer } from './runtime-resolver.js';

/**
 * Resolve Paja's one authoritative environment from a trusted frame identity.
 * The caller persists this exact snapshot with the frame registration so its
 * prelude and later shell.init cannot drift when host policy changes.
 */
export function resolvePajaFrameEnvironment(
  hooks: ShellAdapter,
  identity: OriginIdentity,
): PajaShellEnvironment {
  return resolveShellEnvironment(hooks, identity);
}

export function getTargetIdentity(
  config: PajaHostConfig,
  resolvedTarget?: PajaResolvedPointer | null,
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
  resolvedTarget?: PajaResolvedPointer | null,
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

export async function navigateFrame(
  frame: HTMLIFrameElement,
  config: PajaHostConfig,
  generation: number,
  adapter: ShellAdapter,
  resolvedTarget?: PajaResolvedPointer | null,
  windowId?: string,
  isCurrent?: () => boolean,
  onRegistered?: (windowId: string | null) => void,
): Promise<string | null> {
  const identity = getTargetOriginIdentity(config, resolvedTarget);
  const environment = resolvePajaFrameEnvironment(adapter, identity);
  const domains = environment.capabilities.domains;
  if (config.target.mode === 'runtime-pointer') {
    if (!resolvedTarget) {
      frame.removeAttribute('src');
      frame.srcdoc = '<!doctype html><html><body></body></html>';
      return null;
    }
    if (isCurrent && !isCurrent()) return null;
    const registeredWindowId = registerFrameForGeneration(frame, config, generation, identity, environment, windowId);
    onRegistered?.(registeredWindowId);
    frame.removeAttribute('src');
    frame.srcdoc = injectNappletNamespacePrelude(
      injectPajaRuntimeCsp(
        resolvedTarget.indexHtml,
        connectOrigins([...resolvedTarget.relays, ...resolvedTarget.blossomServers]),
      ),
      { domains },
    );
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

export function renderTargetErrorHtml(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `<!doctype html><html><body><pre>${escapeHtml(message)}</pre></body></html>`;
}

function connectOrigins(urls: readonly string[]): string[] {
  const out = new Set<string>();
  for (const value of urls) {
    try {
      const url = new URL(value);
      if (url.protocol === 'wss:' || url.protocol === 'ws:') {
        out.add(value.replace(/\/$/, ''));
      } else {
        out.add(url.origin);
      }
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
