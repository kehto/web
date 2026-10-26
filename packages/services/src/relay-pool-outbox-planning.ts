import type { NostrFilter } from '@napplet/core';
import type { OutboxRelayPlan } from './outbox-service.js';
import type { RequiredRelayResolution, RouterCtx } from './relay-pool-outbox-types.js';

/** Collect a deduplicated author set from filters + explicit option hints. */
export function deriveAuthors(filters: NostrFilter[], optionAuthors?: string[]): string[] {
  const authors = new Set<string>();
  for (const filter of filters) {
    for (const author of filter.authors ?? []) authors.add(author);
  }
  for (const author of optionAuthors ?? []) authors.add(author);
  return [...authors];
}

/** Apply the relay gate to a candidate set, deduplicating. */
export function allowed(ctx: RouterCtx, urls: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const url of urls) {
    if (ctx.isRelayAllowed(url)) out.add(url);
  }
  return [...out];
}

export async function resolveRequiredRelays(
  ctx: RouterCtx,
  pubkeys: string[],
  direction: 'read' | 'write',
): Promise<RequiredRelayResolution> {
  const useWrite = direction === 'read';
  const relays = new Set<string>();
  const missingAuthors: string[] = [];
  const deniedAuthors: string[] = [];
  const uniquePubkeys = [...new Set(pubkeys)];

  if (uniquePubkeys.length === 0) return { relays: [], missingAuthors, deniedAuthors };

  const lists = await ctx.loadRelayLists(uniquePubkeys);
  for (const pubkey of uniquePubkeys) {
    const entry = lists.get(pubkey);
    const candidateRelays = entry ? (useWrite ? entry.write : entry.read) : undefined;
    if (!candidateRelays || candidateRelays.length === 0) {
      missingAuthors.push(pubkey);
      continue;
    }

    const allowedRelays = allowed(ctx, candidateRelays);
    if (allowedRelays.length === 0) {
      deniedAuthors.push(pubkey);
      continue;
    }

    for (const url of allowedRelays) relays.add(url);
  }

  return { relays: [...relays], missingAuthors, deniedAuthors };
}

/**
 * Resolve the relay plan for a set of pubkeys. Returns the allowed relay set,
 * its provenance, and any pubkeys whose relay list was unavailable.
 */
export async function resolvePlan(
  ctx: RouterCtx,
  pubkeys: string[],
  direction: 'read' | 'write',
  relayHints?: string[],
): Promise<OutboxRelayPlan> {
  const useWrite = direction === 'read';
  const discovered = new Set<string>();
  const missingAuthors: string[] = [];
  let sawNip65 = false;

  if (pubkeys.length > 0) {
    const lists = await ctx.loadRelayLists(pubkeys);
    for (const pubkey of pubkeys) {
      const entry = lists.get(pubkey);
      const relays = entry ? (useWrite ? entry.write : entry.read) : undefined;
      if (relays && relays.length > 0) {
        sawNip65 = true;
        for (const url of relays) discovered.add(url);
      } else {
        missingAuthors.push(pubkey);
      }
    }
  }

  const hintRelays = allowed(ctx, relayHints ?? []);
  let relays = allowed(ctx, discovered);
  let source: OutboxRelayPlan['source'];
  if (relays.length > 0) {
    source = sawNip65 ? 'nip65' : 'policy';
  } else {
    relays = allowed(ctx, ctx.fallbackRelays);
    source = relays.length > 0 ? 'fallback' : 'policy';
  }

  // Relay hints from the napplet augment the host-owned plan, subject to the relay gate.
  for (const url of hintRelays) {
    if (!relays.includes(url)) relays.push(url);
  }
  if (relays.length === 0) source = 'fallback';

  const plan: OutboxRelayPlan = { relays, source };
  if (missingAuthors.length > 0) plan.missingAuthors = missingAuthors;
  return plan;
}
