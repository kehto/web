import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

/** ContextVM server pubkey the target's catalog must answer for. */
export const CVM_FIXTURE_SERVER = 'c'.repeat(64);
/** Shell-local family label of the target's one registry family. */
export const CVM_FIXTURE_FAMILY = 'conformance-echo';
/** The family's one MCP tool, exactly as the server lists it. */
export const CVM_FIXTURE_TOOL = Object.freeze({
  name: 'echo',
  description: 'Echo the text argument',
  inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({ text: Object.freeze({ type: 'string' }) }), required: Object.freeze(['text']) }),
});

const SERVER = { pubkey: CVM_FIXTURE_SERVER };
const SELECTOR = { family: CVM_FIXTURE_FAMILY };
const HEX64 = /^[0-9a-f]{64}$/;

type Reply = Readonly<Record<string, unknown>> | null;

/** NAP-CVM: `schemaHashes` MUST equal the distinct CEP-15 hashes of the entry's nonempty `tools`. */
function registryEntry(entry: unknown): SemanticVerdict {
  const value = entry as { schemaHashes?: unknown; tools?: unknown } | undefined;
  if (!Array.isArray(value?.tools) || !value.tools.length) return `tools was ${JSON.stringify(value?.tools)}, expected a nonempty list`;
  const tools = value.tools as { name?: unknown; inputSchema?: unknown; schemaHash?: unknown }[];
  const bad = tools.find((tool) => typeof tool.name !== 'string' || !tool.inputSchema || typeof tool.schemaHash !== 'string' || !HEX64.test(tool.schemaHash));
  if (bad) return `tool ${JSON.stringify(bad)} lacks name, inputSchema or a verified schemaHash`;
  if (!Array.isArray(value.schemaHashes)) return `schemaHashes was ${JSON.stringify(value.schemaHashes)}`;
  const expected = [...new Set(tools.map((tool) => tool.schemaHash as string))].sort();
  const actual = [...value.schemaHashes].sort();
  return JSON.stringify(actual) === JSON.stringify(expected) && actual.length === value.schemaHashes.length ? null : `schemaHashes ${JSON.stringify(value.schemaHashes)} is not the distinct set of tool hashes ${JSON.stringify(expected)}`;
}

const tag = (rule: string, verify: (reply: Reply) => SemanticVerdict) => ({ rule, verify });

const toolsList = (id: string, rpcId: number): OperationCase => ({
  id, type: 'cvm.request', payload: { server: SERVER, message: { jsonrpc: '2.0', id: rpcId, method: 'tools/list' } },
  semantics: tag('A request-form MCP message completes with the matching MCP response, carrying the caller\'s JSON-RPC id', (reply) => {
    const message = reply?.message as { jsonrpc?: unknown; id?: unknown; result?: unknown } | undefined;
    return message?.jsonrpc === '2.0' && message.id === rpcId && message.result ? null : `message was ${JSON.stringify(message)}`;
  }),
});

/** A shell failure: the matching `.result` with the NAP's top-level text error and no success payload. */
const failure = (id: string, type: string, payload: Record<string, unknown>, error: string, absent: readonly string[], rule: string): OperationCase => ({
  id, type, payload, allowError: true,
  semantics: tag(rule, (reply) => {
    if (reply?.error !== error) return `error was ${JSON.stringify(reply?.error)}, expected ${JSON.stringify(error)}`;
    const present = absent.filter((key) => reply && key in reply);
    return present.length ? `a failed result still carried ${present.join(', ')}` : null;
  }),
});

const request = (message: unknown, options?: Record<string, unknown>) => ({ server: SERVER, ...(message === undefined ? {} : { message }), ...(options ? { options } : {}) });

const closeOnly = tag('A successful cvm.close.result carries only type and id', (reply) => {
  const extra = Object.keys(reply ?? {}).filter((key) => key !== 'type' && key !== 'id');
  return extra.length ? `close result carried ${extra.join(', ')}` : null;
});

/** NAP-CVM at napplet/naps#31 (28cf1bdb): discovery, raw MCP, registry, close and session events. */
export const CVM_FIXTURE: DomainFixture = {
  domain: 'cvm',
  cases: [
    { id: 'cvm/discover', type: 'cvm.discover', payload: { query: { search: 'echo', limit: 5 } } },
    toolsList('cvm/request', 7),
    {
      id: 'cvm/registry.list', type: 'cvm.registry.list', payload: { query: { family: CVM_FIXTURE_FAMILY } },
      semantics: tag('Every registry entry\'s schemaHashes equals the distinct hashes of its tools', (reply) => {
        const entries = reply?.entries;
        if (!Array.isArray(entries) || !entries.length) return `entries was ${JSON.stringify(entries)}`;
        return entries.map(registryEntry).find((problem) => problem !== null) ?? null;
      }),
    },
    {
      id: 'cvm/registry.has', type: 'cvm.registry.has', payload: { selector: SELECTOR },
      semantics: tag('registry.has answers a boolean has', (reply) => (reply?.has === true ? null : `has was ${JSON.stringify(reply?.has)}`)),
    },
    {
      id: 'cvm/registry.describe', type: 'cvm.registry.describe', payload: { selector: SELECTOR },
      semantics: tag('registry.describe returns the family entry; its schemaHashes equals the distinct hashes of its tools', (reply) => registryEntry(reply?.entry)),
    },
    {
      id: 'cvm/registry.call', type: 'cvm.registry.call', payload: { selector: SELECTOR, tool: CVM_FIXTURE_TOOL.name, args: { text: 'conformance' } },
      semantics: tag('registry.call returns the McpToolResult of tools/call', (reply) => {
        const content = (reply?.result as { content?: { text?: unknown }[] } | undefined)?.content;
        return Array.isArray(content) && content[0]?.text === 'conformance' ? null : `result was ${JSON.stringify(reply?.result)}`;
      }),
    },
    failure('cvm/discover-invalid-limit', 'cvm.discover', { query: { limit: 0 } }, 'invalid request', ['servers'],
      'A malformed query is "invalid request"; on a shell error, success payload fields MUST be omitted'),
    failure('cvm/request-missing-message', 'cvm.request', request(undefined), 'invalid message', ['message'],
      'A missing MCP message is "invalid message"; validation errors MUST NOT be reported as "unsupported method"'),
    failure('cvm/request-null-id', 'cvm.request', request({ jsonrpc: '2.0', id: null, method: 'tools/list' }), 'invalid message', ['message'],
      'An MCP message with id: null is "invalid message" (conformance case: missing message, id: null, or both result and error)'),
    failure('cvm/request-result-and-error', 'cvm.request', request({ jsonrpc: '2.0', id: 9, result: {}, error: { code: 1, message: 'x' } }), 'invalid message', ['message'],
      'An MCP message with both result and error is "invalid message"'),
    failure('cvm/request-timeout-zero', 'cvm.request', request({ jsonrpc: '2.0', id: 10, method: 'tools/list' }, { timeoutMs: 0 }), 'invalid timeout', ['message'],
      'timeoutMs MUST be an integer from 1 through 300000; zero returns "invalid timeout"'),
    failure('cvm/registry.describe-unknown-family', 'cvm.registry.describe', { selector: { family: 'conformance-no-such-family' } }, 'family not found', ['entry'],
      'registry.describe with an unmatched family label is "family not found"'),
    failure('cvm/registry.call-wrong-tool', 'cvm.registry.call', { selector: SELECTOR, tool: 'not-in-family', args: {} }, 'schema mismatch', ['result'],
      'registry.call with a tool name outside the selected verified tool set is "schema mismatch" before publication'),
    { id: 'cvm/close', type: 'cvm.close', payload: { server: SERVER }, semantics: closeOnly },
  ],
  pushes: [
    {
      id: 'cvm/event', type: 'cvm.event',
      subscribe: toolsList('cvm/request-session', 8),
      trigger: { control: 'cvm.notify' },
      match: { server: SERVER },
      unsubscribe: { id: 'cvm/close-session', type: 'cvm.close', payload: { server: SERVER }, semantics: closeOnly },
      semantics: {
        rule: 'cvm.event carries no envelope id, only server and an MCP message, and reaches the endpoint whose session is open; close releases it',
        verify: (push) => (push && !('id' in push) && (push.message as { jsonrpc?: unknown } | undefined)?.jsonrpc === '2.0' ? null : `event was ${JSON.stringify(push)}`),
      },
    },
  ],
};
