import { createCvmService, type CvmServerRef, type CvmTransport, type McpMessage } from '@kehto/services';
import { CVM_FIXTURE_FAMILY, CVM_FIXTURE_SERVER, CVM_FIXTURE_SERVER_REQUEST_ID, CVM_FIXTURE_TOOL } from '../../fixtures/cvm.js';
import type { DomainBackendModule } from './types.js';

/** CEP-15 hash of {@link CVM_FIXTURE_TOOL}; `cvm-backend.test.ts` proves it equals the computed value. */
export const CVM_FIXTURE_TOOL_HASH = 'ba2f8d20d08479f6470738db31b303f76f22439dc986f7da509784cc8e94fe04';

/** Relay origin the CVM plans name. Planning only: nothing connects to it. */
const CVM_RELAY = 'wss://relay.conformance.invalid/';

/** The in-memory ContextVM server's answer to one MCP request. */
function serve(message: McpMessage): McpMessage {
  const reply = (body: Record<string, unknown>): McpMessage => ({ jsonrpc: '2.0', id: message.id, ...body }) as McpMessage;
  if (message.method === 'tools/list') return reply({ result: { tools: [structuredClone(CVM_FIXTURE_TOOL)] } });
  if (message.method === 'tools/call') {
    const params = (message.params ?? {}) as { name?: unknown; arguments?: { text?: unknown } };
    if (params.name !== CVM_FIXTURE_TOOL.name) return reply({ error: { code: -32602, message: `unknown tool ${String(params.name)}` } });
    return reply({ result: { content: [{ type: 'text', text: String(params.arguments?.text ?? '') }], isError: false } });
  }
  return reply({ error: { code: -32601, message: `method not found: ${String(message.method)}` } });
}

/** NAP-CVM backend: the reference CVM service over an in-memory transport and one pinned registry family. */
export const CVM_BACKEND: DomainBackendModule = {
  domain: 'cvm',
  create() {
    const emitters = new Set<(server: CvmServerRef, message: McpMessage) => void>();
    const requests: McpMessage[] = [];
    const published: McpMessage[] = [];
    const closed: string[] = [];
    const transport: CvmTransport = {
      planDiscover: () => [CVM_RELAY],
      planRequest: () => [CVM_RELAY],
      async discover(query) {
        if (query?.kinds && query.kinds.length === 0) return [];
        const servers = [{ pubkey: CVM_FIXTURE_SERVER, relays: [CVM_RELAY], name: 'Conformance echo', capabilities: ['tools'] }];
        return query?.limit ? servers.slice(0, query.limit) : servers;
      },
      async request(server, message) {
        requests.push(structuredClone(message));
        if (server.pubkey !== CVM_FIXTURE_SERVER) throw new Error('server not found');
        return serve(message);
      },
      // Notifications and responses: published as given, nothing awaited.
      async publish(server, message) {
        if (server.pubkey !== CVM_FIXTURE_SERVER) throw new Error('server not found');
        published.push(structuredClone(message));
      },
      // Every request is answered before request() returns, so none is ever
      // in flight to cancel: a cancellation is dropped, never published.
      async cancel() { return false; },
      async close(server) { closed.push(server.pubkey); },
      onEvent(handler) {
        emitters.add(handler);
        return { close() { emitters.delete(handler); } };
      },
    };
    const cvm = createCvmService({
      transport,
      registry: [{ family: CVM_FIXTURE_FAMILY, server: { pubkey: CVM_FIXTURE_SERVER }, tools: [{ name: CVM_FIXTURE_TOOL.name, schemaHash: CVM_FIXTURE_TOOL_HASH }], description: 'Echo tools' }],
    });
    return {
      services: { cvm },
      controls: {
        /** The fixture server emits one MCP progress notification. */
        'cvm.notify': () => {
          const message = { jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: 'conformance', progress: 50 } } as McpMessage;
          for (const emit of emitters) emit({ pubkey: CVM_FIXTURE_SERVER }, message);
        },
        /** The fixture server sends one server-initiated MCP request with a fixed id. */
        'cvm.serverRequest': () => {
          const message = { jsonrpc: '2.0', id: CVM_FIXTURE_SERVER_REQUEST_ID, method: 'roots/list' } as McpMessage;
          for (const emit of emitters) emit({ pubkey: CVM_FIXTURE_SERVER }, message);
        },
        /** Evidence: every MCP message the transport carried, and every server it closed. */
        'cvm.transport': () => ({ requests: [...requests], published: [...published], closed: [...closed] }),
      },
      dispose() { cvm.dispose(); },
    };
  },
};
