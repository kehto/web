/**
 * cvm-types.ts — NAP-CVM (ContextVM bridge) wire + MCP value types.
 *
 * Kehto-internal model for the NAP-CVM wire contract (upstream draft:
 * napplet/nubs NAP-CVM, namespace `window.napplet.cvm`). The literal `type`
 * strings and field names below MUST match the upstream `@napplet/nap/cvm`
 * envelopes byte-for-byte so the shim client interoperates; the types live
 * here (not imported from `@napplet/core`) per the same convention as
 * NUB-RESOURCE (PROJECT.md Decision #31) to avoid a peer-dependency version
 * bump.
 *
 * ContextVM transports MCP JSON-RPC over Nostr (kind 25910), optionally
 * gift-wrap encrypted (CEP-4). The shell owns all transport, signing,
 * encryption, and relay routing; the napplet only supplies a server identity
 * and the MCP operation it wants.
 */

/** A single MCP JSON-RPC message (request, response, or notification). */
export interface McpMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

/** An MCP tool descriptor, as returned by `tools/list`. */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/** A content block inside an MCP tool result. */
export interface McpContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/** The result of an MCP `tools/call`. */
export interface McpToolResult {
  content: McpContentBlock[];
  isError?: boolean;
  [key: string]: unknown;
}

/** Reference to a ContextVM server by public key, with optional relay hints. */
export interface CvmServerRef {
  /** Hex Nostr public key of the ContextVM server. */
  pubkey: string;
  /** Optional relay hints; the shell MAY use, ignore, or augment these. */
  relays?: string[];
}

/** Query for `cvm.discover`. */
export interface CvmDiscoverQuery {
  search?: string;
  kinds?: number[];
  relays?: string[];
  limit?: number;
}

/** A discovered ContextVM server announcement. */
export interface CvmServer extends CvmServerRef {
  name?: string;
  description?: string;
  capabilities?: string[];
  paymentRequired?: boolean;
}

/** Per-request options for `cvm.request`. */
export interface CvmRequestOptions {
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
  /** Perform an MCP `initialize` handshake before the request. */
  initialize?: boolean;
  /** Payment policy when a server requires value exchange (NAP-VALUE). */
  payment?: 'deny' | 'prompt' | 'allow';
}

/**
 * Wire envelopes — NIP-5D format `{ type: "cvm.<action>", ...payload }`. The
 * shell echoes the request `id` in every `*.result`; `cvm.event` has no id.
 */

export interface CvmDiscoverMessage {
  type: 'cvm.discover';
  id: string;
  query?: CvmDiscoverQuery;
}

export interface CvmDiscoverResultMessage {
  type: 'cvm.discover.result';
  id: string;
  servers: CvmServer[];
  error?: string;
}

export interface CvmRequestMessage {
  type: 'cvm.request';
  id: string;
  server: CvmServerRef;
  message: McpMessage;
  options?: CvmRequestOptions;
}

export interface CvmRequestResultMessage {
  type: 'cvm.request.result';
  id: string;
  /** The MCP response. MCP-level errors live in `message.error`. */
  message?: McpMessage;
  /** Transport/shell-policy error (distinct from MCP-level errors). */
  error?: string;
}

export interface CvmCloseMessage {
  type: 'cvm.close';
  id: string;
  server: CvmServerRef;
}

export interface CvmCloseResultMessage {
  type: 'cvm.close.result';
  id: string;
  error?: string;
}

export interface CvmEventMessage {
  type: 'cvm.event';
  server: CvmServerRef;
  message: McpMessage;
}

/** Napplet → shell CVM envelopes. */
export type CvmInboundMessage = CvmDiscoverMessage | CvmRequestMessage | CvmCloseMessage;
/** Shell → napplet CVM envelopes. */
export type CvmOutboundMessage =
  | CvmDiscoverResultMessage
  | CvmRequestResultMessage
  | CvmCloseResultMessage
  | CvmEventMessage;

/**
 * Documented transport/shell-policy error strings for `*.result.error`.
 * MCP-level errors are returned inside `message.error` instead.
 */
export type CvmTransportError =
  | 'server not found'
  | 'relay timeout'
  | 'initialization failed'
  | 'payment required'
  | 'payment denied'
  | 'unsupported method'
  | 'policy denied';
