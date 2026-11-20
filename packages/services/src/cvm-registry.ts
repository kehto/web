import { computeCvmToolSchemaHash } from './cvm-schema-hash.js';
import type { CvmRegistryCallOptions, CvmRegistryEntry, CvmRegistryFamily, CvmRegistryQuery, CvmRegistryTool } from './cvm-registry-types.js';
import type { CvmServerRef, McpMessage } from './cvm-types.js';

export type CvmRegistryRequest = (server: CvmServerRef, method: string, params?: Record<string, unknown>, options?: CvmRegistryCallOptions) => Promise<McpMessage>;
/** Validated selector, or a list query's selector fields (which may both be absent). */
type Selection = Pick<CvmRegistryQuery, 'family' | 'schemaHash'>;
const HASH = /^[0-9a-f]{64}$/u;
const METHODS = new Set(['cvm.registry.list', 'cvm.registry.has', 'cvm.registry.describe', 'cvm.registry.call']);

export function isCvmRegistryMethod(type: string): boolean { return METHODS.has(type); }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function selector(value: unknown, optional = false): Selection {
  if (!record(value)) { if (optional && value === undefined) return {}; throw new Error('invalid request'); }
  if ((value.family !== undefined && (typeof value.family !== 'string' || !value.family.trim()))
    || (value.schemaHash !== undefined && (typeof value.schemaHash !== 'string' || !HASH.test(value.schemaHash)))
    || (!optional && value.family === undefined && value.schemaHash === undefined)) throw new Error('invalid request');
  return value as Selection;
}
function result(message: McpMessage): Record<string, unknown> {
  if (message.error !== undefined) {
    const error = message.error;
    throw new Error(record(error) && typeof error.message === 'string' ? error.message : 'provider unavailable');
  }
  if (!record(message.result)) throw new Error('provider unavailable');
  return message.result;
}
function options(value: unknown): CvmRegistryCallOptions {
  if (value === undefined) return {};
  if (!record(value)) throw new Error('invalid request');
  const server = value.server;
  if (server !== undefined && (!record(server) || typeof server.pubkey !== 'string' || !HASH.test(server.pubkey)
    || (server.relays !== undefined && (!Array.isArray(server.relays) || !server.relays.every(url => typeof url === 'string'))))) throw new Error('invalid request');
  if (value.cache !== undefined && !['default', 'reload', 'no-store'].includes(String(value.cache))) throw new Error('cache policy denied');
  if (value.timeoutMs !== undefined && (!Number.isInteger(value.timeoutMs) || Number(value.timeoutMs) < 1 || Number(value.timeoutMs) > 300000)) throw new Error('invalid timeout');
  if (value.payment !== undefined && !['deny', 'prompt', 'allow'].includes(String(value.payment))) throw new Error('invalid request');
  if (value.initialize !== undefined && typeof value.initialize !== 'boolean') throw new Error('invalid request');
  return value as CvmRegistryCallOptions;
}

async function verifiedTools(server: CvmServerRef, request: CvmRegistryRequest, opts: CvmRegistryCallOptions): Promise<CvmRegistryTool[]> {
  const data = result(await request(server, 'tools/list', undefined, opts));
  if (!Array.isArray(data.tools) || data.tools.length > 256) throw new Error('schema mismatch');
  // Pagination requires an explicit complete inventory; never claim an incomplete family matches.
  if (data.nextCursor !== undefined) throw new Error('provider unavailable');
  const tools: CvmRegistryTool[] = [];
  for (const raw of data.tools) {
    if (!record(raw) || typeof raw.name !== 'string' || !raw.name || !record(raw.inputSchema)
      || (raw.outputSchema !== undefined && !record(raw.outputSchema))) throw new Error('schema mismatch');
    const tool = { name: raw.name, inputSchema: raw.inputSchema,
      ...(record(raw.outputSchema) ? { outputSchema: raw.outputSchema } : {}),
      ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
    };
    const schemaHash = await computeCvmToolSchemaHash(tool);
    const advertised = record(raw._meta) && record(raw._meta['io.contextvm/common-schema'])
      ? raw._meta['io.contextvm/common-schema'].schemaHash : undefined;
    if (advertised !== undefined && advertised !== schemaHash) throw new Error('schema mismatch');
    if (tools.some(entry => entry.name === tool.name)) throw new Error('schema mismatch');
    tools.push({ name: tool.name, inputSchema: tool.inputSchema, schemaHash,
      ...(typeof tool.description === 'string' ? { description: tool.description } : {}),
      ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
    });
  }
  return tools;
}

async function entries(families: readonly CvmRegistryFamily[], select: Selection, request: CvmRegistryRequest,
  opts: CvmRegistryCallOptions): Promise<CvmRegistryEntry[]> {
  const found: CvmRegistryEntry[] = [];
  const inventories = new Map<string, CvmRegistryTool[]>();
  for (const family of families) {
    if (!select.schemaHash && select.family && family.family !== select.family) continue;
    if (opts.server && opts.server.pubkey !== family.server.pubkey) continue;
    const server = opts.server ?? family.server;
    const key = JSON.stringify(server);
    let tools = inventories.get(key);
    if (!tools) { tools = await verifiedTools(server, request, opts); inventories.set(key, tools); }
    const selected = select.schemaHash ? tools.filter(tool => tool.schemaHash === select.schemaHash)
      : family.tools.map(pin => tools!.find(tool => tool.name === pin.name && tool.schemaHash === pin.schemaHash));
    if (!selected.length || selected.some(tool => !tool)) continue;
    const verified = selected as CvmRegistryTool[];
    found.push({ family: family.family, ...(family.description ? { description: family.description } : {}),
      schemaHashes: [...new Set(verified.map(tool => tool.schemaHash))], selected: server, providers: [server], tools: verified });
    if (select.schemaHash) break;
  }
  return found;
}

/** Resolve only host-configured providers, verifying live schemas before selection or invocation. */
export async function handleCvmRegistry(message: Record<string, unknown>, families: readonly CvmRegistryFamily[],
  request: CvmRegistryRequest): Promise<Record<string, unknown>> {
  const type = String(message.type);
  const listing = type === 'cvm.registry.list';
  const select = selector(listing ? message.query : message.selector, listing);
  const opts = options(message.options);
  const query = (message.query ?? {}) as Record<string, unknown>;
  if (listing && ((query.limit !== undefined && (!Number.isInteger(query.limit) || Number(query.limit) < 1))
    || (query.search !== undefined && typeof query.search !== 'string')
    || (query.category !== undefined && typeof query.category !== 'string'))) throw new Error('invalid request');
  if (type === 'cvm.registry.call' && (typeof message.tool !== 'string' || !message.tool
    || (message.args !== undefined && !record(message.args)))) throw new Error('invalid request');
  if (!families.length) {
    if (type === 'cvm.registry.has') return { has: false };
    throw new Error('unsupported method');
  }
  const candidates = listing ? families.filter(family =>
    (query.category === undefined || family.categories?.includes(String(query.category)))
    && (query.search === undefined || `${family.family} ${family.description ?? ''}`.toLowerCase().includes(String(query.search).toLowerCase()))) : families;
  let matches: CvmRegistryEntry[];
  try { matches = await entries(candidates, select, request, opts); }
  catch (error) {
    if (type === 'cvm.registry.has') return { has: false };
    throw error;
  }
  if (listing) return { entries: matches.slice(0, typeof query.limit === 'number' ? query.limit : undefined) };
  if (type === 'cvm.registry.has') return { has: matches.length > 0 };
  const entry = matches[0];
  if (!entry) throw new Error(select.schemaHash ? 'schema mismatch' : 'family not found');
  if (type === 'cvm.registry.describe') return { entry };
  if (!entry.tools.some(tool => tool.name === message.tool)) throw new Error('schema mismatch');
  return { result: result(await request(entry.selected!, 'tools/call', { name: message.tool, arguments: message.args ?? {} }, opts)) };
}
