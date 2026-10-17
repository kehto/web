import {
  admitBrowserDocument,
  denyNappletControllerAccess,
  originRegistry,
  resolveShellEnvironment,
  type OriginIdentity,
  type ShellAdapter,
  type SessionEntry,
} from '@kehto/shell';
import type { Runtime } from '@kehto/runtime';

import { isPajaLocalTarget, type PajaRuntimeTarget } from './local-target.js';
import type { PajaHostConfig } from './options.js';
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
  if (!resolvedTarget) return Object.freeze({ dTag: target.dTag, aggregateHash: target.aggregateHash });
  const permissionPrincipal = isPajaLocalTarget(resolvedTarget)
    ? { kind: 'development' as const, target: `local-file:${encodeURIComponent(resolvedTarget.fileName)}`,
      artifactHash: resolvedTarget.aggregateHash }
    : { kind: 'verified' as const, manifestKey: resolvedTarget.manifest.catalogId,
      artifactHash: resolvedTarget.aggregateHash };
  return Object.freeze({ dTag: target.dTag, aggregateHash: target.aggregateHash, permissionPrincipal });
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
  runtime: Runtime,
  resolvedTarget?: PajaRuntimeTarget | null,
  windowId?: string,
  isCurrent?: () => boolean,
  onRegistered?: (windowId: string | null) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  denyNappletControllerAccess(frame);
  if (config.target.mode === 'runtime-pointer') {
    if (!resolvedTarget || signal?.aborted || (isCurrent && !isCurrent())) return null;
    const identity = getTargetOriginIdentity(config, resolvedTarget);
    const environment = resolvePajaFrameEnvironment(adapter, identity);
    const local = isPajaLocalTarget(resolvedTarget);
    return admitPajaFrame({
      frame, config, generation, runtime, identity, environment,
      verifiedHtml: resolvedTarget.indexHtml,
      required: local ? [] : resolvedTarget.manifest.requires,
      optional: local ? environment.capabilities.domains : (resolvedTarget.manifest.optional ?? []),
      windowId, isCurrent, onRegistered, signal,
    });
  }
  const fetched = await fetchTargetHtml();
  if (signal?.aborted || (isCurrent && !isCurrent())) return null;
  const targetUrl = new URL(config.target.url);
  if (!['http:', 'https:'].includes(targetUrl.protocol) || targetUrl.username || targetUrl.password) {
    throw new Error('Paja development target must have an exact HTTP(S) URL');
  }
  const identity: OriginIdentity = Object.freeze({
    dTag: config.window.dTag,
    aggregateHash: fetched.sha256,
    permissionPrincipal: { kind: 'development' as const, target: targetUrl.href, artifactHash: fetched.sha256 },
  });
  const environment = resolvePajaFrameEnvironment(adapter, identity);
  return admitPajaFrame({
    frame, config, generation, runtime, identity, environment,
    verifiedHtml: injectBaseHref(fetched.html, targetUrl.href),
    required: [], optional: environment.capabilities.domains,
    windowId, isCurrent, onRegistered, signal,
  });
}

interface PajaFrameAdmission {
  readonly frame: HTMLIFrameElement;
  readonly config: PajaHostConfig;
  readonly generation: number;
  readonly runtime: Runtime;
  readonly identity: OriginIdentity;
  readonly environment: PajaShellEnvironment;
  readonly verifiedHtml: string;
  readonly required: readonly string[];
  readonly optional: readonly string[];
  readonly windowId?: string;
  readonly isCurrent?: () => boolean;
  readonly onRegistered?: (windowId: string | null) => void;
  readonly signal?: AbortSignal;
}

async function admitPajaFrame(options: PajaFrameAdmission): Promise<string | null> {
  const { frame, config, generation, runtime, identity, environment, verifiedHtml,
    required, optional, windowId, isCurrent, onRegistered, signal } = options;
  if (!identity.permissionPrincipal) throw new Error('Paja source has no trusted permission principal');
  const sourceWindowId = windowId ?? `${config.window.id}:${generation}`;
  const current = () => !signal?.aborted && (!isCurrent || isCurrent()) && frame.isConnected !== false;
  const entry: SessionEntry = {
    pubkey: '', windowId: sourceWindowId, origin: 'null', type: 'nip5d',
    dTag: identity.dTag, aggregateHash: identity.aggregateHash,
    permissionPrincipal: identity.permissionPrincipal,
    registeredAt: Date.now(), instanceId: crypto.randomUUID(), provenance: 'nip-5d',
  };
  const result = await admitBrowserDocument({
    runtime, entry, verifiedHtml, available: environment.capabilities.domains,
    required, optional,
    remoteSources: (config.csp?.connectOrigins ?? []).map((origin) => ({ directive: 'connect-src' as const, origin })),
    isCurrentSource: current, signal,
    commit(srcdoc, admitted) {
      if (!current()) throw new Error('Paja source changed before admission commit');
      const admittedDomains = new Set(admitted.domains);
      const restricted = Object.freeze({
        capabilities: Object.freeze({ domains: Object.freeze([...admitted.domains]) }),
        services: Object.freeze(environment.services.filter((service) => admittedDomains.has(service))),
      });
      const registeredWindowId = registerFrameForGeneration(frame, config, generation, identity, restricted, sourceWindowId);
      if (!registeredWindowId) throw new Error('Paja frame has no content window');
      onRegistered?.(registeredWindowId);
      frame.removeAttribute('src');
      frame.srcdoc = srcdoc;
    },
    onRetire() {
      const win = frame.contentWindow;
      if (win && originRegistry.getWindowId(win) === sourceWindowId) {
        originRegistry.unregister(sourceWindowId);
        frame.srcdoc = '<!doctype html><html><body></body></html>';
        onRegistered?.(null);
      }
    },
  });
  if (result.status === 'committed') return result.windowId;
  if (result.status === 'cancelled') return null;
  throw new Error(`Paja Firewall launch admission ${result.status}${result.deniedRequired.length ? `: ${result.deniedRequired.join(', ')}` : ''}`);
}

export function renderTargetErrorHtml(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `<!doctype html><html><body><pre>${escapeHtml(message)}</pre></body></html>`;
}

async function fetchTargetHtml(): Promise<{ readonly html: string; readonly sha256: string }> {
  const requestUrl = new URL('./__kehto/target.html', window.location.href);
  const response = await fetch(requestUrl, {
    cache: 'no-store',
    headers: {
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`Paja target fetch failed: ${response.status} ${response.statusText}`);
  }
  if (response.redirected || response.url !== requestUrl.href) {
    throw new Error('Paja development proxy redirected after target selection');
  }
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { html: new TextDecoder().decode(bytes), sha256 };
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
