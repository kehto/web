/**
 * Keep NAP-OUTBOX relay plans inside one Firewall approval.
 *
 * A Firewall request carries at most `MAX_PERMISSION_REQUIREMENTS`
 * requirements. That cap bounds evaluation work, grant growth and prompt size,
 * and an outbox plan is not purely host-generated: the napplet picks the
 * authors, third parties publish their NIP-65 lists, and read hints are
 * appended. So the plan is bounded here instead of the cap being raised
 * (kehto/web#455). Every relay that is contacted is still one exact,
 * approved network origin.
 *
 * Authority: NAP-OUTBOX draft napplet/naps#32 at
 * `8865f73d52a4864afee145f28d26520476273927`. Shell Behavior: "The shell MAY
 * use NIP-66 or other relay intelligence to choose among candidate relays."
 * Security Considerations: "Shells SHOULD limit broad outbox queries" and
 * "SHOULD enforce limits, timeouts, and maximum subscription counts."
 *
 * @module
 */

import { MAX_PERMISSION_REQUIREMENTS } from '@kehto/runtime';
import { OUTBOX_TOO_MANY_RELAYS } from './outbox-reasons.js';
import { parseRelayUrl, relayOrigin } from './relay-url-policy.js';

/**
 * Most distinct relay origins one OUTBOX operation may contact: the Firewall
 * requirement cap less the `outbox` interface requirement.
 */
export const OUTBOX_RELAY_ORIGIN_BUDGET = MAX_PERMISSION_REQUIREMENTS - 1;

/** A plan's relays after budgeting. */
export interface BudgetedRelays {
  readonly relays: string[];
  /** Some requested author lost every usable relay, so a read is partial. */
  readonly partial: boolean;
}

interface OriginCandidate {
  readonly origin: string;
  readonly urls: string[];
  readonly authors: Set<string>;
}

/** Group usable relay URLs by origin, first-seen order; unusable URLs are left out. */
function groupByOrigin(candidates: ReadonlyMap<string, ReadonlySet<string>>): Map<string, OriginCandidate> {
  const groups = new Map<string, OriginCandidate>();
  for (const [url, authors] of candidates) {
    const origin = parseRelayUrl(url)?.origin;
    if (!origin) continue;
    let group = groups.get(origin);
    if (!group) groups.set(origin, group = { origin, urls: [], authors: new Set() });
    group.urls.push(url);
    for (const author of authors) group.authors.add(author);
  }
  return groups;
}

/** Most authors still uncovered, then most authors, then origin order: deterministic. */
function better(a: OriginCandidate, aGain: number, b: OriginCandidate | undefined, bGain: number): boolean {
  if (!b) return true;
  if (aGain !== bGain) return aGain > bGain;
  if (a.authors.size !== b.authors.size) return a.authors.size > b.authors.size;
  return a.origin < b.origin;
}

/**
 * Greedy author cover: each round takes the origin reaching the most authors
 * not yet reached. Gains are kept current through an author index, so the
 * work is linear in the candidate entries plus budget × origins.
 */
function coverAuthors(groups: Map<string, OriginCandidate>, budget: number): OriginCandidate[] {
  const gain = new Map<OriginCandidate, number>();
  const byAuthor = new Map<string, OriginCandidate[]>();
  for (const group of groups.values()) {
    gain.set(group, group.authors.size);
    for (const author of group.authors) {
      const list = byAuthor.get(author);
      if (list) list.push(group);
      else byAuthor.set(author, [group]);
    }
  }
  const chosen: OriginCandidate[] = [];
  while (chosen.length < budget && gain.size > 0) {
    let best: OriginCandidate | undefined;
    let bestGain = -1;
    for (const [group, value] of gain) {
      if (better(group, value, best, bestGain)) { best = group; bestGain = value; }
    }
    // Once every author is reached, the same order adds redundancy, then hints.
    chosen.push(best!);
    gain.delete(best!);
    for (const author of best!.authors) {
      const holders = byAuthor.get(author);
      if (!holders) continue;
      byAuthor.delete(author);
      for (const holder of holders) if (gain.has(holder)) gain.set(holder, gain.get(holder)! - 1);
    }
  }
  return chosen;
}

/**
 * Choose a read plan's relays within the approval budget.
 *
 * Unusable URLs are skipped. A plan within budget keeps its order. A larger
 * plan is chosen by author coverage, so every author with a usable relay keeps
 * one while the budget allows, and relays without authors (napplet hints,
 * host fallback) go last.
 *
 * @param candidates - Relay URL to the requested authors it serves, in planner order.
 * @param budget - Distinct origins allowed, default {@link OUTBOX_RELAY_ORIGIN_BUDGET}.
 * @returns The chosen relay URLs and whether some author lost every relay.
 * @example
 * ```ts
 * selectReadRelays(new Map([['wss://a.example', new Set([pubkey])]])).relays; // ['wss://a.example']
 * ```
 */
export function selectReadRelays(
  candidates: ReadonlyMap<string, ReadonlySet<string>>,
  budget: number = OUTBOX_RELAY_ORIGIN_BUDGET,
): BudgetedRelays {
  const groups = groupByOrigin(candidates);
  const chosen = groups.size <= budget ? [...groups.values()] : coverAuthors(groups, budget);
  const reached = new Set(chosen.flatMap((group) => [...group.authors]));
  let partial = false;
  for (const authors of candidates.values()) {
    for (const author of authors) if (!reached.has(author)) partial = true;
  }
  return { relays: chosen.flatMap((group) => group.urls), partial };
}

/**
 * Bound any router's plan before approval. Required relays must be usable and
 * all fit; the rest are best effort, so unusable ones are skipped and the
 * plan is cut at the budget in the router's own order.
 *
 * @param relays - The plan's relay URLs, in router priority order.
 * @param required - Host-only required relays, a subset of `relays`.
 * @param budget - Distinct origins allowed, default {@link OUTBOX_RELAY_ORIGIN_BUDGET}.
 * @returns The kept relays and whether any were left out.
 * @throws `invalid relay destination` for an unusable required relay, or when
 *   no relay is usable; `too many relays` when the required origins alone exceed the budget.
 * @example
 * ```ts
 * boundPlanRelays(['wss://a.example', 'not a url'], []); // { relays: ['wss://a.example'], partial: true }
 * ```
 */
export function boundPlanRelays(
  relays: readonly string[],
  required: readonly string[],
  budget: number = OUTBOX_RELAY_ORIGIN_BUDGET,
): BudgetedRelays {
  const requiredOrigins = new Set<string>();
  for (const url of required) {
    const origin = parseRelayUrl(url)?.origin;
    if (!origin) throw new Error('invalid relay destination');
    requiredOrigins.add(origin);
  }
  if (requiredOrigins.size > budget) throw new Error(OUTBOX_TOO_MANY_RELAYS);
  const kept = new Set(requiredOrigins);
  const out: string[] = [];
  let partial = false;
  for (const url of relays) {
    const origin = parseRelayUrl(url)?.origin;
    if (!origin) { partial = true; continue; }
    if (!kept.has(origin)) {
      if (kept.size >= budget) { partial = true; continue; }
      kept.add(origin);
    }
    out.push(url);
  }
  if (relays.length > 0 && out.length === 0) throw new Error('invalid relay destination');
  return { relays: out, partial };
}

/**
 * Distinct relay origins, in first-seen order. One approval per origin covers
 * every relay path on it, so duplicates never count against the cap.
 *
 * @param relays - Usable relay URLs.
 * @returns Their origins, deduplicated.
 * @example
 * ```ts
 * relayOrigins(['wss://a.example/x', 'wss://a.example/y']); // ['wss://a.example']
 * ```
 */
export function relayOrigins(relays: readonly string[]): string[] {
  return [...new Set(relays.map(relayOrigin))];
}
