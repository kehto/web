import type { NostrFilter } from '@napplet/core';
import type { OutboxRelayPlan } from './outbox-service.js';
import type { OutboxPublishOptions } from './outbox-service.js';
import type { PublishTargetResolution, RelayListEntry, RequiredRelayResolution, RouterCtx } from './relay-pool-outbox-types.js';

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

/**
 * Load NIP-65 relay lists, treating a throwing or rejecting loader as "no
 * lists". Relays fail as a matter of course on Nostr, so discovery failure
 * degrades to missing authors and the caller's fallback rules (NAP-OUTBOX draft
 * `8865f73d`, Shell Behavior: "SHOULD fall back to configured relays when NIP-65
 * data is absent, stale, or unreachable"). It never becomes a denial.
 */
export async function loadRelayListsOrEmpty(ctx: RouterCtx, pubkeys: string[]): Promise<Map<string, RelayListEntry>> {
  try {
    return await ctx.loadRelayLists(pubkeys);
  } catch {
    return new Map();
  }
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

  // A failed relay-list lookup is a discovery failure, never a policy outcome:
  // every author is reported missing, which callers surface as
  // `relay list unavailable` (NAP-OUTBOX: fallback never substitutes for a
  // required `toInboxes` read relay).
  const lists = await loadRelayListsOrEmpty(ctx, uniquePubkeys);
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
    const lists = await loadRelayListsOrEmpty(ctx, pubkeys);
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

/**
 * Resolve the full write/inbox/hint relay set a publish should fan out to.
 *
 * Own-outbox and `toInboxes` relays are required targets; caller hints are
 * best-effort extras. A relay-gate refusal of a required author's relays is
 * shell policy (`policy denied`); a missing relay list is
 * `relay list unavailable`.
 *
 * @param ctx - Router dependencies.
 * @param signed - The signing identity (an event or a pre-sign pubkey).
 * @param options - Publish fanout options.
 * @param allowOwnFallback - Use host fallback relays when the signer has no list.
 * @returns All targets, the required subset, or an error reason.
 */
export async function resolvePublishTargets(
  ctx: RouterCtx,
  signed: { readonly pubkey: string },
  options?: OutboxPublishOptions,
  allowOwnFallback = false,
): Promise<PublishTargetResolution> {
  const targets = new Set<string>();
  const requiredTargets = new Set<string>();

  if (options?.toOutbox !== false) {
    // The author's own write relays (outbox model for the user's own event).
    const outboxPlan = await resolveRequiredRelays(ctx, [signed.pubkey], 'read');
    if (outboxPlan.deniedAuthors.length > 0) return { relayUrls: [], requiredRelayUrls: [], error: 'policy denied' };
    const ownRelays = outboxPlan.missingAuthors.length > 0 && allowOwnFallback ? allowed(ctx, ctx.fallbackRelays) : outboxPlan.relays;
    if (ownRelays.length === 0) return { relayUrls: [], requiredRelayUrls: [], error: 'relay list unavailable' };
    for (const url of ownRelays) {
      targets.add(url);
      requiredTargets.add(url);
    }
  }

  if (options?.toInboxes && options.toInboxes.length > 0) {
    const inboxPlan = await resolveRequiredRelays(ctx, options.toInboxes, 'write');
    if (inboxPlan.missingAuthors.length > 0) return { relayUrls: [], requiredRelayUrls: [], error: 'relay list unavailable' };
    if (inboxPlan.deniedAuthors.length > 0) return { relayUrls: [], requiredRelayUrls: [], error: 'policy denied' };
    for (const url of inboxPlan.relays) {
      targets.add(url);
      requiredTargets.add(url);
    }
  }

  for (const url of options?.relays ?? []) targets.add(url);
  return {
    relayUrls: allowed(ctx, targets),
    requiredRelayUrls: allowed(ctx, requiredTargets),
  };
}
