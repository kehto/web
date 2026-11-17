import { decode } from 'nostr-tools/nip19';
import { verifyEvent } from 'nostr-tools/pure';
import type { NostrEvent, NostrFilter } from '@napplet/core';
import { computeCvmToolSchemaHash, type CvmRegistryFamily } from '@kehto/services';
import { normalizePajaCvmRelays } from './multiplayer-config.js';

const HASH = /^[0-9a-f]{64}$/u;
const MAX_BYTES = 1_000_000;
const LIMIT = 64;
type DiscoveryInput = { type: 'hash'; hash: string } | { type: 'website'; url: string }
  | { type: 'event'; id: string; author?: string; relays: string[] };
export interface CvmDiscoveryCandidate {
  config: CvmRegistryFamily;
  source: string;
  eventId: string;
}
export interface CvmDiscoveryDependencies {
  relays: string[];
  query(relays: string[], filters: NostrFilter[], signal: AbortSignal): Promise<NostrEvent[]>;
  fetch: typeof fetch;
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }

/** Detect the user's reference without treating an opaque family label as a portable identity. */
export function parseCvmDiscoveryInput(input: string): DiscoveryInput {
  const text = input.trim().replace(/^nostr:/iu, '');
  if (!text || text.length > 2048) throw new Error('Enter a nevent, a 64-character tool schema hash, or a website URL.');
  if (/^naddr1/iu.test(text)) throw new Error('CVM announcements use nevent. Addressable naddr family manifests are not defined by ContextVM.');
  if (/^[0-9a-f]{64}$/iu.test(text)) return { type: 'hash', hash: text.toLowerCase() };
  if (/^nevent1/iu.test(text)) {
    const decoded = decode(text);
    if (decoded.type !== 'nevent' || (decoded.data.kind !== undefined && ![11316, 11317].includes(decoded.data.kind))) throw new Error('Use a CVM server or tool-list announcement (kind 11316 or 11317).');
    return { type: 'event', id: decoded.data.id, author: decoded.data.author, relays: decoded.data.relays?.length ? normalizePajaCvmRelays(decoded.data.relays) : [] };
  }
  const url = new URL(text.includes('://') ? text : `https://${text}`);
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) throw new Error('Use an HTTPS website URL without credentials.');
  return { type: 'website', url: `${url.origin}/.well-known/napplet.json` };
}

async function websiteProvider(url: string, deps: CvmDiscoveryDependencies, signal: AbortSignal): Promise<{ pubkey: string; relays: string[] }> {
  let response: Response;
  try { response = await deps.fetch(url, { signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' }); }
  catch (error) { if (signal.aborted) throw error; throw new Error('Cannot read the discovery document. The website must allow cross-origin requests (CORS).'); }
  if (!response.ok) throw new Error(`Discovery document returned HTTP ${response.status}.`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Discovery document is too large.');
  const body = await response.text();
  if (body.length > MAX_BYTES) throw new Error('Discovery document is too large.');
  const document: unknown = JSON.parse(body);
  if (!record(document) || document.version !== 1 || !record(document.backend)
    || typeof document.backend.pubkey !== 'string' || !HASH.test(document.backend.pubkey)) throw new Error('Expected version 1 with backend.pubkey and backend.relays.');
  return { pubkey: document.backend.pubkey, relays: normalizePajaCvmRelays(document.backend.relays) };
}

function matches(event: NostrEvent, filter: NostrFilter): boolean {
  return (!filter.ids || filter.ids.includes(event.id)) && (!filter.authors || filter.authors.includes(event.pubkey))
    && (!filter.kinds || filter.kinds.includes(event.kind))
    && Object.entries(filter).every(([key, values]) => !key.startsWith('#') || !Array.isArray(values)
      || event.tags.some(tag => tag[0] === key.slice(1) && values.includes(tag[1])));
}

async function query(deps: CvmDiscoveryDependencies, relays: string[], filter: NostrFilter, signal: AbortSignal): Promise<NostrEvent[]> {
  signal.throwIfAborted();
  const events = await deps.query(relays, [{ ...filter, limit: LIMIT }], signal);
  signal.throwIfAborted();
  return events.slice(0, LIMIT).filter(event => {
    try {
      // Do not inherit nostr-tools' cached verification symbol across a host boundary.
      const { id, pubkey, sig, kind, created_at, tags, content } = event;
      return content.length <= MAX_BYTES && matches(event, filter) && verifyEvent({ id, pubkey, sig, kind, created_at, tags, content });
    }
    catch { return false; }
  }).sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id));
}

async function inventory(event: NostrEvent): Promise<CvmRegistryFamily['tools']> {
  const payload: unknown = JSON.parse(event.content);
  if (!record(payload) || !Array.isArray(payload.tools) || !payload.tools.length || payload.tools.length > LIMIT || payload.nextCursor !== undefined) throw new Error('Announcement must contain a complete inventory of 1–64 tools.');
  const names = new Set<string>();
  const tools: { name: string; schemaHash: string }[] = [];
  for (const raw of payload.tools) {
    if (!record(raw) || typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 256 || names.has(raw.name)
      || !record(raw.inputSchema) || (raw.outputSchema !== undefined && !record(raw.outputSchema))) throw new Error('Announcement contains an invalid tool schema.');
    names.add(raw.name);
    const schemaHash = await computeCvmToolSchemaHash({ name: raw.name, inputSchema: raw.inputSchema,
      ...(record(raw.outputSchema) ? { outputSchema: raw.outputSchema } : {}) });
    const metadata = record(raw._meta) ? raw._meta['io.contextvm/common-schema'] : undefined;
    if (metadata !== undefined && (!record(metadata) || metadata.schemaHash !== schemaHash)) throw new Error('Announcement schema hash does not match its tool definition.');
    const tags = event.tags.filter(tag => tag[0] === 'i' && tag[2] === raw.name);
    if (tags.some(tag => tag[1] !== schemaHash)) throw new Error('Announcement schema tag does not match its tool definition.');
    tools.push({ name: raw.name, schemaHash });
  }
  return tools;
}

/** Resolve public, signed inventories only; callers explicitly select local family membership. */
export async function discoverCvmFamilies(input: string, deps: CvmDiscoveryDependencies, signal: AbortSignal): Promise<CvmDiscoveryCandidate[]> {
  const reference = parseCvmDiscoveryInput(input);
  let relays: string[], events: NostrEvent[];
  if (reference.type === 'website') {
    const provider = await websiteProvider(reference.url, deps, signal);
    relays = provider.relays;
    events = await query(deps, relays, { kinds: [11317], authors: [provider.pubkey] }, signal);
  } else {
    relays = normalizePajaCvmRelays(reference.type === 'event' && reference.relays.length ? reference.relays : deps.relays);
    events = await query(deps, relays, reference.type === 'hash' ? { kinds: [11317], '#i': [reference.hash] }
      : { ids: [reference.id], kinds: [11316, 11317], ...(reference.author ? { authors: [reference.author] } : {}) }, signal);
    if (reference.type === 'event' && events[0]?.kind === 11316) events = await query(deps, relays, { kinds: [11317], authors: [events[0].pubkey] }, signal);
  }
  // Kinds 11316/11317 are replaceable: never rescue an invalid newest inventory with stale schemas.
  const latest = new Map<string, NostrEvent>();
  for (const event of events) if (!latest.has(event.pubkey)) latest.set(event.pubkey, event);
  const candidates: CvmDiscoveryCandidate[] = [];
  let failure: unknown;
  for (const event of latest.values()) {
    try {
      const tools = await inventory(event);
      if (reference.type === 'hash' && !tools.some(tool => tool.schemaHash === reference.hash)) throw new Error('Announcement does not implement the requested schema hash.');
      const relayList = reference.type === 'website' ? undefined
        : (await query(deps, relays, { kinds: [10002], authors: [event.pubkey] }, signal))[0];
      const providerRelays = relayList ? normalizePajaCvmRelays(relayList.tags.filter(tag => tag[0] === 'r').map(tag => tag[1])) : relays;
      candidates.push({ config: { family: `cvm.${event.pubkey.slice(0, 12)}`, server: { pubkey: event.pubkey, relays: providerRelays }, tools },
        eventId: event.id, source: `${reference.type === 'website' ? reference.url : input.trim()} · event ${event.id}` });
    } catch (error) { failure = error; }
  }
  signal.throwIfAborted();
  if (!candidates.length) throw failure ?? new Error('No verified tool announcements found. Check the reference and discovery relays; hash searches require CEP-15 i tags.');
  return candidates;
}
