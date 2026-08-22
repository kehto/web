import {
  injectNappletNamespacePrelude,
  originRegistry,
} from '@kehto/shell';

import {
  getMissingRequiredNaps,
  getPlaygroundShellEnvironment,
} from './demo-hooks.js';
import { RESOURCE_DEMO_REMOTE_IMAGE_ORIGIN } from './main-preferences.js';
import {
  injectCspMeta,
  PLAYGROUND_MANIFEST_AUTHOR,
  resolvePlaygroundNapplet,
  type PlaygroundNapplet,
} from './napplet-resolver.js';
import type { NappletInfo } from './shell-host.js';

/** Static per-dTag origins visualized in the injected iframe CSP. */
const STATIC_ORIGIN_ALLOWLIST: ReadonlyMap<string, readonly string[]> = new Map([
  ['resource-demo', [RESOURCE_DEMO_REMOTE_IMAGE_ORIGIN]],
]);

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

  // Register before srcdoc executes so shell.ready owns session creation.
  if (iframe.contentWindow) {
    originRegistry.register(iframe.contentWindow, windowId, identity);
    originRegistry.setEnvironment(iframe.contentWindow, environment);
  }

  iframe.addEventListener('load', () => {
    if (
      iframe.contentWindow
      && originRegistry.getWindowId(iframe.contentWindow) !== windowId
    ) {
      // srcdoc may replace contentWindow; bind any replacement for its handshake.
      originRegistry.register(iframe.contentWindow, windowId, identity);
      originRegistry.setEnvironment(iframe.contentWindow, environment);
    }
    host.clearIntentGeneration(windowId);
  });

  if (options.beforeRender) await options.beforeRender({ dTag, aggregateHash });
  const origins = STATIC_ORIGIN_ALLOWLIST.get(dTag) ?? [];
  iframe.srcdoc = injectNappletNamespacePrelude(
    injectCspMeta(resolved.indexHtml, origins),
    environment.capabilities,
  );

  return info;
}

function playgroundPath(pathname: string): string {
  const cleanPath = pathname.replace(/^\/+/, '');
  const basePath = (import.meta.env.BASE_URL ?? '/').trim() || '/';
  if (basePath === './') return cleanPath;
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${normalizedBase}${cleanPath}`;
}
