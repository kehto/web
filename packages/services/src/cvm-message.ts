/**
 * cvm-message.ts — NAP-CVM MCP message form classification.
 *
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb, Message handling): the shell MUST
 * validate a `cvm.request` message before publishing. "Missing messages,
 * batches, invalid IDs, and invalid field combinations return
 * `"invalid message"`." The three accepted forms follow MCP:
 *
 * | Form         | Fields                                                    |
 * |--------------|-----------------------------------------------------------|
 * | Request      | `method` and `id`; no `result` or `error`                 |
 * | Notification | `method`, no `id`, `result`, or `error`                   |
 * | Response     | `id`, exactly one of `result` or `error`; no `method` or `params` |
 *
 * MCP IDs are strings or integers (never `null`), and `params`, `result` and
 * `error` are objects. `@kehto/mocks` classifies with the same table
 * (`classifyMcpMessage`); `tests/unit/cvm-message-form-parity.test.ts` keeps
 * the two in step.
 */

/** The MCP form of a valid NAP-CVM message. */
export type McpMessageForm = 'request' | 'notification' | 'response';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validId(value: unknown): boolean {
  return typeof value === 'string' || (typeof value === 'number' && Number.isInteger(value));
}

/**
 * Classify a `cvm.request` message by its MCP form.
 *
 * @param value - The envelope's `message` field.
 * @returns The form, or `null` when NAP-CVM requires `"invalid message"`.
 * @example
 * ```ts
 * mcpMessageForm({ jsonrpc: '2.0', id: 1, method: 'tools/list' }); // 'request'
 * mcpMessageForm({ jsonrpc: '2.0', id: null, method: 'tools/list' }); // null
 * ```
 */
export function mcpMessageForm(value: unknown): McpMessageForm | null {
  if (!isRecord(value) || value.jsonrpc !== '2.0') return null;
  if (value.id !== undefined && !validId(value.id)) return null;
  if (value.params !== undefined && !isRecord(value.params)) return null;
  const hasResult = value.result !== undefined;
  const hasError = value.error !== undefined;
  if (value.method !== undefined) {
    if (typeof value.method !== 'string' || value.method.length === 0 || hasResult || hasError) return null;
    return value.id === undefined ? 'notification' : 'request';
  }
  if (value.id === undefined || value.params !== undefined || hasResult === hasError) return null;
  if (hasResult ? !isRecord(value.result) : !isRecord(value.error)) return null;
  return 'response';
}
