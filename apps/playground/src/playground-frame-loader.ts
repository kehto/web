import {
  admitBrowserDocument,
  denyNappletControllerAccess,
  originRegistry,
  type SessionEntry,
} from '@kehto/shell';
import type { Runtime } from '@kehto/runtime';

import {
  getMissingRequiredNaps,
  getPlaygroundShellEnvironment,
} from './demo-hooks.js';
import {
  PLAYGROUND_MANIFEST_AUTHOR,
  resolvePlaygroundNapplet,
  type PlaygroundNapplet,
} from './napplet-resolver.js';
import type { NappletInfo } from './shell-host.js';

export interface LoadedNappletIdentity {
  dTag: string;
  aggregateHash: string;
}

export interface LoadNappletOptions {
  /**
   * Hook invoked after the napplet is resolved and verified but before the
   * verified bytes are injected into the iframe.
   */
  beforeRender?: (identity: LoadedNappletIdentity) => void | Promise<void>;
  /**
   * Synchronously admit the verified result before any frame is created.
   */
  acceptResolved?: (identity: LoadedNappletIdentity) => boolean;
  /** Persist the verified result as an installed artifact. Defaults to true. */
  installInCatalog?: boolean;
}

export interface PlaygroundFrameLoaderHost {
  readonly napplets: Map<string, NappletInfo>;
  getRuntime(): Runtime;
  clearIntentGeneration(windowId: string): void;
  installVerifiedNapplet(
    resolved: PlaygroundNapplet,
    restart: { name: string; containerId: string },
  ): unknown;
}

let nappletCounter = 0;

/**
 * Resolve, verify, register, and render a playground napplet frame.
 *
 * @param host - Host-owned frame and catalog operations.
 * @param name - Napplet d-tag to resolve.
 * @param containerId - DOM container that receives the iframe.
 * @param options - Admission and pre-render hooks.
 * @returns The live napplet frame record.
 */
export async function loadPlaygroundNapplet(
  host: PlaygroundFrameLoaderHost,
  name: string,
  containerId: string,
  options: LoadNappletOptions = {},
): Promise<NappletInfo> {
  // Resolve + verify content-addressed bytes: relays (NIP-65 outbox) → Blossom →
  // verify signature + aggregate + every blob. The gateway is never in the trust
  // path; identity is computed from the verified bytes.
  const resolved = await resolvePlaygroundNapplet({
    dTag: name,
    author: PLAYGROUND_MANIFEST_AUTHOR,
    relayDiscoveryUrl: playgroundPath('/napplet-relay/relay-list'),
    blossomServers: [playgroundPath('/napplet-blossom')],
  });

  const { dTag, aggregateHash } = resolved;
  const identity = Object.freeze({ dTag, aggregateHash });
  const environment = getPlaygroundShellEnvironment(identity);
  const missingRequiredNaps = getMissingRequiredNaps(
    resolved.requires,
    environment.capabilities.domains,
  );
  if (missingRequiredNaps.length > 0) {
    throw new Error(
      `[demo] ${resolved.dTag} requires unsupported NAP capabilities: ${missingRequiredNaps.join(', ')}`,
    );
  }

  if (options.acceptResolved && !options.acceptResolved(identity)) {
    throw new Error(`[demo] ${resolved.dTag} no longer matches the selected installed artifact`);
  }

  // Resolver verification is the only route into persistent handler authority.
  if (options.installInCatalog !== false) {
    host.installVerifiedNapplet(resolved, { name, containerId });
  }

  const windowId = `demo-${name}-${++nappletCounter}`;
  const iframe = document.createElement('iframe');
  iframe.id = windowId;
  iframe.className = 'w-full h-full border-0';
  denyNappletControllerAccess(iframe);
  iframe.sandbox.add('allow-scripts');

  const container = document.getElementById(containerId);
  if (container) container.appendChild(iframe);

  const info: NappletInfo = {
    windowId,
    name,
    iframe,
    dTag: identity.dTag,
    aggregateHash: identity.aggregateHash,
    environment,
    identityBound: false,
  };
  host.napplets.set(windowId, info);
  const controller = new AbortController();
  let retireAdmission: (() => void) | undefined;
  let committed = false;
  let committedLoads = 0;
  const current = () => !controller.signal.aborted && host.napplets.get(windowId) === info
    && iframe.isConnected && (!options.acceptResolved || options.acceptResolved(identity));
  const removeCurrent = () => {
    if (host.napplets.get(windowId) !== info) return;
    host.napplets.delete(windowId);
    originRegistry.unregister(windowId);
    iframe.remove();
    host.clearIntentGeneration(windowId);
  };
  info.dispose = () => {
    controller.abort();
    retireAdmission?.();
    removeCurrent();
  };

  iframe.addEventListener('load', () => {
    if (!committed || !current()) return;
    if (++committedLoads > 1) {
      info.dispose?.();
      return;
    }
    // A srcdoc navigation may replace contentWindow while preserving this frame.
    const win = iframe.contentWindow;
    if (win && originRegistry.getWindowId(win) !== windowId) {
      originRegistry.register(win, windowId, {
        ...identity,
        permissionPrincipal: { kind: 'verified', manifestKey: resolved.catalogId, artifactHash: aggregateHash },
      });
      originRegistry.setEnvironment(win, info.environment);
    }
  });

  try {
    if (options.beforeRender) await options.beforeRender({ dTag, aggregateHash });
    if (!current()) throw new Error(`[demo] ${dTag} source retired before admission`);
    const principal = Object.freeze({ kind: 'verified' as const,
      manifestKey: resolved.catalogId, artifactHash: aggregateHash });
    const entry: SessionEntry = {
      pubkey: '', windowId, origin: 'null', type: 'nip5d', dTag, aggregateHash,
      permissionPrincipal: principal,
      registeredAt: Date.now(), instanceId: crypto.randomUUID(), provenance: 'nip-5d',
    };
    const admitted = await admitBrowserDocument({
      runtime: host.getRuntime(), entry, verifiedHtml: resolved.indexHtml,
      available: environment.capabilities.domains,
      required: resolved.requires, optional: resolved.optional ?? [], remoteSources: [],
      signal: controller.signal, isCurrentSource: current,
      commit(srcdoc, result) {
        if (!current()) throw new Error('Playground source changed before admission commit');
        const admittedDomains = new Set(result.domains);
        info.environment = Object.freeze({
          capabilities: Object.freeze({ domains: Object.freeze([...result.domains]) }),
          services: Object.freeze(environment.services.filter((service) => admittedDomains.has(service))),
        });
        const win = iframe.contentWindow;
        if (!win) throw new Error('Playground frame has no content window');
        originRegistry.register(win, windowId, { ...identity, permissionPrincipal: principal });
        originRegistry.setEnvironment(win, info.environment);
        committed = true;
        iframe.srcdoc = srcdoc;
      },
      onRetire: removeCurrent,
    });
    if (admitted.status !== 'committed') {
      throw new Error(`[demo] ${dTag} admission ${admitted.status}${admitted.deniedRequired.length ? `: ${admitted.deniedRequired.join(', ')}` : ''}`);
    }
    retireAdmission = admitted.retire;
    if (!current()) {
      admitted.retire();
      throw new Error(`[demo] ${dTag} source retired after admission`);
    }
    return info;
  } catch (error) {
    info.dispose?.();
    throw error;
  }
}

function playgroundPath(pathname: string): string {
  const cleanPath = pathname.replace(/^\/+/, '');
  const basePath = (import.meta.env.BASE_URL ?? '/').trim() || '/';
  if (basePath === './') return cleanPath;
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${normalizedBase}${cleanPath}`;
}
