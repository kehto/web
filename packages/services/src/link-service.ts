/**
 * link-service.ts — NAP-LINK reference service.
 *
 * Shell-mediated user-visible navigation. The napplet requests `link.open`;
 * the shell validates policy and hands navigation to a host-owned context.
 */

import type { LinkOpenErrorCode, LinkOpenOptions, LinkOpenResult, NappletMessage } from '@napplet/core';
import type { LinkOpenMessage, LinkOpenResultMessage } from '@napplet/nap/link/types';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';

const LINK_SERVICE_VERSION = '1.0.0';
const DEFAULT_ALLOWED_PROTOCOLS = ['http:', 'https:'] as const;

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
  return allowedProtocols.includes(url.protocol);
}

async function handleOpen(
  options: LinkServiceOptions,
  windowId: string,
  message: LinkOpenMessage,
  send: (msg: NappletMessage) => void,
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
    const result = await options.open({ windowId, url: parsed, options: message.options });
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
  const descriptor: ServiceDescriptor = {
    name: 'link',
    version: LINK_SERVICE_VERSION,
    description: 'NAP-LINK reference handler for shell-mediated link opening',
  };

  return {
    descriptor,
    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      if (message.type === 'link.open') {
        void handleOpen(options, windowId, message as LinkOpenMessage, send);
        return;
      }

      const id = (message as NappletMessage & { id?: string }).id ?? '';
      send({
        type: `${message.type}.error`,
        id,
        error: `Unknown link method: ${message.type}`,
      } as NappletMessage);
    },
    onWindowDestroyed(_windowId: string): void {
      /* no per-window state */
    },
  };
}
