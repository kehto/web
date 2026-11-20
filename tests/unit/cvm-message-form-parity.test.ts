/**
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb, Message handling): the reference CVM
 * service and the `@kehto/mocks` CVM mock classify `cvm.request` messages with
 * the same MCP form table, so a napplet sees `invalid message` for the same
 * inputs whichever one Paja or a test host wires in.
 */
import { describe, expect, it } from 'vitest';
import { mcpMessageForm } from '../../packages/services/src/cvm-message.js';
import { classifyMcpMessage } from '../../packages/mocks/src/domains/cvm-fixtures.js';

const VECTORS: ReadonlyArray<readonly [string, unknown, 'request' | 'notification' | 'response' | null]> = [
  ['request', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, 'request'],
  ['request with string id and params', { jsonrpc: '2.0', id: 'a', method: 'tools/call', params: { name: 'x' } }, 'request'],
  ['notification', { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } }, 'notification'],
  ['result response', { jsonrpc: '2.0', id: 1, result: {} }, 'response'],
  ['error response', { jsonrpc: '2.0', id: 's', error: { code: -1, message: 'no' } }, 'response'],
  ['missing message', undefined, null],
  ['null message', null, null],
  ['batch', [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }], null],
  ['wrong jsonrpc', { jsonrpc: '1.0', id: 1, method: 'tools/list' }, null],
  ['id: null', { jsonrpc: '2.0', id: null, method: 'tools/list' }, null],
  ['boolean id', { jsonrpc: '2.0', id: true, method: 'tools/list' }, null],
  ['fractional id', { jsonrpc: '2.0', id: 1.5, method: 'tools/list' }, null],
  ['empty method', { jsonrpc: '2.0', id: 1, method: '' }, null],
  ['non-string method', { jsonrpc: '2.0', id: 1, method: 7 }, null],
  ['array params', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: [1] }, null],
  ['request with result', { jsonrpc: '2.0', id: 1, method: 'tools/list', result: {} }, null],
  ['notification with error', { jsonrpc: '2.0', method: 'n', error: { code: 1, message: 'x' } }, null],
  ['both result and error', { jsonrpc: '2.0', id: 9, result: {}, error: { code: 1, message: 'x' } }, null],
  ['response with params', { jsonrpc: '2.0', id: 1, result: {}, params: {} }, null],
  ['response with neither result nor error', { jsonrpc: '2.0', id: 1 }, null],
  ['response without id', { jsonrpc: '2.0', result: {} }, null],
  ['non-object result', { jsonrpc: '2.0', id: 1, result: 5 }, null],
  ['non-object error', { jsonrpc: '2.0', id: 1, error: 'no' }, null],
  ['no method and no id', { jsonrpc: '2.0' }, null],
];

describe('NAP-CVM MCP message forms: services and mocks agree', () => {
  it.each(VECTORS)('%s', (_label, message, form) => {
    expect(mcpMessageForm(message)).toBe(form);
    expect(classifyMcpMessage(message)).toBe(form);
  });
});
