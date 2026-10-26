/**
 * link-service.ts — NAP-LINK reference service.
 *
 * Shell-mediated user-visible navigation. The napplet requests `link.open`;
 * the shell validates policy and hands navigation to a host-owned context.
 */

import type { LinkOpenErrorCode, LinkOpenOptions, LinkOpenResult, NappletMessage } from '@napplet/core';
import type { LinkOpenMessage, LinkOpenResultMessage } from '@napplet/nap/link/types';
import type { ApprovalSignal, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';

const LINK_SERVICE_VERSION = '1.0.0';
const DEFAULT_ALLOWED_PROTOCOLS = ['http:', 'https:'] as const;
const FORBIDDEN_PROTOCOLS = new Set(['javascript:', 'data:', 'blob:', 'file:', 'about:', 'filesystem:']);

/**
 * Host context passed to {@link LinkServiceOptions.open}.
 */
export interface LinkOpenContext {
  /** Window id of the requesting napplet. */
  windowId: string;
  /** Parsed absolute URL after validation. */
  url: URL;
  /** Optional untrusted napplet display hints. */
  options?: LinkOpenOptions;
  /** Observe before any side effect after awaiting host work. */
  signal?: ApprovalSignal;
}

/**
 * Options for {@link createLinkService}.
 */
export interface LinkServiceOptions {
  /**
   * Protocols allowed before host policy runs. Defaults to `http:` and `https:`.
   */
  allowedProtocols?: readonly string[];
  /**
   * Host-owned opener. Return `{ status: "opened" }` after handing navigation
   * to the host context, or `{ status: "denied" }` to reject by policy/user.
   * When omitted, all otherwise-valid URLs are denied.
   */
  open?: (context: LinkOpenContext) => LinkOpenResult | Promise<LinkOpenResult>;
}

function denied(id: string, error: LinkOpenErrorCode): LinkOpenResultMessage {
  return { type: 'link.open.result', id, status: 'denied', error };
}

function parseLinkUrl(id: string, rawUrl: string): URL | LinkOpenResultMessage {
  try {
    return new URL(rawUrl);
  } catch {
    return denied(id, 'invalid-url');
  }
}

function isProtocolAllowed(url: URL, allowedProtocols: readonly string[]): boolean {
  return !FORBIDDEN_PROTOCOLS.has(url.protocol) && allowedProtocols.includes(url.protocol);
}

async function handleOpen(
  options: LinkServiceOptions,
  windowId: string,
  message: LinkOpenMessage,
  send: (msg: NappletMessage) => void,
  runtime: ServiceRuntimeContext | undefined,
  current: () => boolean,
  warnLegacy: () => void,
): Promise<void> {
  const parsed = parseLinkUrl(message.id, message.url);
  if ('type' in parsed) {
    send(parsed as NappletMessage);
    return;
  }

  const allowedProtocols = options.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
  if (!isProtocolAllowed(parsed, allowedProtocols)) {
    send(denied(message.id, 'unsupported-scheme') as NappletMessage);
    return;
  }

  if (!options.open) {
    send(denied(message.id, 'blocked-by-policy') as NappletMessage);
    return;
  }

  try {
    const href = parsed.href;
    const open = (signal?: ApprovalSignal) => {
      if (!current() || signal?.aborted) return { status: 'denied' as const };
      return options.open!({ windowId, url: new URL(href), options: message.options, ...(signal ? { signal } : {}) });
    };
    let result: LinkOpenResult;
    if (runtime?.authorizeOperation) {
      const approval = await runtime.authorizeOperation(windowId, 'link.open', [{
        category: 'resource', domain: 'link', operation: 'link.open', scope: { kind: 'exact', value: href },
      }], open);
      if (approval.status === 'cancelled' && !current()) return;
      result = approval.status === 'executed' ? approval.value : { status: 'denied' };
    } else {
      warnLegacy();
      result = await open();
    }
    send({
      type: 'link.open.result',
      id: message.id,
      status: result.status,
      ...(result.status === 'denied' ? { error: 'blocked-by-policy' as LinkOpenErrorCode } : {}),
    } as NappletMessage);
  } catch {
    send(denied(message.id, 'blocked-by-policy') as NappletMessage);
  }
}

/**
 * Create the NAP-LINK reference service.
 *
 * @param options - Host policy and opener hooks for link.open requests.
 * @returns A runtime service handler for the `link` domain.
 *
 * @example
 * ```ts
 * const service = createLinkService({
 *   open: ({ url }) => ({ status: url.protocol === 'https:' ? 'opened' : 'denied' }),
 * });
 * ```
 */
export function createLinkService(options: LinkServiceOptions = {}): ServiceHandler {
  let runtime: ServiceRuntimeContext | undefined;
  let warnedLegacy = false;
  const windows = new Map<string, Set<string>>();
  const warnLegacy = () => {
    if (warnedLegacy) return;
    warnedLegacy = true;
    console.warn('[FW-LINK-LEGACY-001] Configure RuntimeAdapter.permissions and verified session permissionPrincipal; host-only LINK approval is deprecated. Warning once per service instance.');
  };
  const descriptor: ServiceDescriptor = {
    name: 'link',
    version: LINK_SERVICE_VERSION,
    description: 'NAP-LINK reference handler for shell-mediated link opening',
  };

  return {
    descriptor,
    onRegistered(context) { windows.clear(); runtime = context; },
    onUnregistered() { windows.clear(); runtime = undefined; },
    // Runtime aborts active approval signals. Keep live source/replay history so
    // held operations can return their canonical denial without being reopened.
    onPermissionRevoked() {},
    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      if (message.type === 'link.open') {
        const input = message as LinkOpenMessage;
        if (typeof input.id !== 'string' || input.id.length === 0 || input.id.length > 256) return;
        if (typeof input.url !== 'string') { send(denied(input.id, 'invalid-url')); return; }
        let ids = windows.get(windowId);
        if (!ids) { ids = new Set(); windows.set(windowId, ids); }
        if (ids.has(input.id)) return;
        if (ids.size >= 4096) { send(denied(input.id, 'blocked-by-policy')); return; }
        ids.add(input.id);
        const generation = ids;
        const current = () => windows.get(windowId) === generation;
        const captured = Object.freeze({ type: 'link.open' as const, id: input.id, url: input.url,
          ...(typeof input.options?.label === 'string' ? { options: Object.freeze({ label: input.options.label }) } : {}),
        });
        void handleOpen(options, windowId, captured, (response) => { if (current()) send(response); }, runtime, current, warnLegacy);
        return;
      }
    },
    onWindowDestroyed(windowId: string): void { windows.delete(windowId); },
  };
}
