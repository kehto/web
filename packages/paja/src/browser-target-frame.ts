import {
  injectNappletNamespacePrelude,
  originRegistry,
  type SessionEntry,
  type ShellBridge,
  type ShellCapabilities,
} from '@kehto/shell';

import type { PajaHostConfig } from './options.js';
import { injectPajaRuntimeCsp, type PajaResolvedPointer } from './runtime-resolver.js';
import type { PajaCapabilityDomain, PajaSimulation } from './simulation.js';

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

export function registerFrameForGeneration(
  bridge: ShellBridge,
  frame: HTMLIFrameElement,
  config: PajaHostConfig,
  generation: number,
  resolvedTarget?: PajaResolvedPointer | null,
  windowId = `${config.window.id}:${generation}`,
): string | null {
  const win = frame.contentWindow;
  if (!win) return null;
  const identity = getTargetIdentity(config, resolvedTarget);
  originRegistry.register(win, windowId, {
    dTag: identity.dTag,
    aggregateHash: identity.aggregateHash,
  });
  bridge.runtime.sessionRegistry.register(windowId, {
    ...identity,
    windowId,
    origin: 'null',
    type: 'napplet',
    registeredAt: Date.now(),
    instanceId: `${windowId}:${Date.now()}`,
    provenance: 'nip-5d',
  });
  return windowId;
}

export async function navigateFrame(
  bridge: ShellBridge,
  frame: HTMLIFrameElement,
  config: PajaHostConfig,
  generation: number,
  capabilities: ShellCapabilities,
  simulation: PajaSimulation,
  resolvedTarget?: PajaResolvedPointer | null,
  windowId?: string,
  isCurrent?: () => boolean,
): Promise<string | null> {
  const domains = getInjectedDomains(capabilities, simulation, resolvedTarget);
  if (config.target.mode === 'runtime-pointer') {
    if (!resolvedTarget) {
      frame.removeAttribute('src');
      frame.srcdoc = '<!doctype html><html><body></body></html>';
      return null;
    }
    if (isCurrent && !isCurrent()) return null;
    const registeredWindowId = registerFrameForGeneration(bridge, frame, config, generation, resolvedTarget, windowId);
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
  const registeredWindowId = registerFrameForGeneration(bridge, frame, config, generation, resolvedTarget, windowId);
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

function getInjectedDomains(
  capabilities: ShellCapabilities,
  simulation: PajaSimulation,
  resolvedTarget?: PajaResolvedPointer | null,
): string[] {
  const available = capabilities.domains.filter((domain) => {
    const knownDomain = domain as PajaCapabilityDomain;
    return simulation.capabilities.domains[knownDomain] !== false;
  });
  const required = resolvedTarget?.manifest.requires ?? [];
  if (required.length === 0) return available;
  const availableSet = new Set(available);
  return required.filter((domain) => availableSet.has(domain));
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
