/**
 * cvm-cancellation.ts — map a napplet's `notifications/cancelled` onto the
 * request id a transport actually sent.
 *
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb, Message handling): "For outgoing
 * requests only, it MAY map IDs to unique transport IDs if it restores the
 * caller's ID in the returned MCP response and consistently maps request
 * references such as cancellation."
 */
import type { McpMessage } from './cvm-types.js';

/**
 * Copy a cancellation with `params.requestId` replaced by the transport id.
 *
 * @param message - The napplet's `notifications/cancelled`.
 * @param transportId - The id the transport sent the cancelled request under.
 * @returns The message to publish; everything else (e.g. `reason`) is kept.
 * @example
 * ```ts
 * mapCancellation({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 2 } }, 'cvm-7-ab12cd34');
 * // → params: { requestId: 'cvm-7-ab12cd34' }
 * ```
 */
export function mapCancellation(message: McpMessage, transportId: string): McpMessage {
  const params = message.params && typeof message.params === 'object' ? message.params as Record<string, unknown> : {};
  return { ...message, params: { ...params, requestId: transportId } };
}
