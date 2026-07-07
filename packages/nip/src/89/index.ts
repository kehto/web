import type { NostrEvent } from 'nostr-tools';

/**
 * `@kehto/nip/89` — NIP-89 application-handler discovery.
 *
 * NIP-89 lets clients answer "who can open an event of kind N?" without
 * hardcoding app knowledge — essential for any runtime that hosts or launches
 * other apps (the napplet model, "open with…" menus, unknown-kind fallbacks).
 *
 * Two event kinds:
 * - **kind 31990 — handler information.** An app advertises which kinds it
 *   handles (`k` tags) and per-platform URL templates to open an entity
 *   (`["web", "https://app/e/<bech32>", "nevent"]`).
 * - **kind 31989 — handler recommendation.** A user recommends a handler for a
 *   given kind via `a` tags pointing at 31990 addresses.
 *
 * `nostr-tools` ships no NIP-89 helper. This module provides pure parsers for
 * both kinds plus URL-template expansion — no relay, signer, or framework
 * coupling.
 *
 * @module
 */

/** Kind 31990 — handler information (an app describing what it can open). */
export const HANDLER_INFORMATION_KIND = 31990;
/** Kind 31989 — handler recommendation (a user endorsing a handler for a kind). */
export const HANDLER_RECOMMENDATION_KIND = 31989;

/** Platform tag names defined by NIP-89 for handler URL templates. */
export const HANDLER_PLATFORMS = ['web', 'ios', 'android', 'macos', 'windows', 'linux'] as const;
/** One of the NIP-89 platform identifiers. */
export type HandlerPlatform = (typeof HANDLER_PLATFORMS)[number];

const PLATFORM_SET = new Set<string>(HANDLER_PLATFORMS);

/**
 * One platform-specific way to open an entity, from a 31990 platform tag.
 *
 * @example
 * ```ts
 * // tag ["web", "https://app.example/e/<bech32>", "nevent"]
 * const target: HandlerTarget = { url: 'https://app.example/e/<bech32>', entity: 'nevent' };
 * ```
 */
export interface HandlerTarget {
  /** URL template containing a `<bech32>` and/or `<raw>` placeholder. */
  url: string;
  /** Optional NIP-19 entity type this template is for (e.g. `'nevent'`, `'naddr'`, `'nprofile'`). */
  entity: string | undefined;
}

/**
 * A parsed kind-31990 handler-information event.
 *
 * @example
 * ```ts
 * const info = parseHandlerInformation(event);
 * info.kinds;            // [1, 30023]
 * info.metadata.name;    // 'My Reader'
 * info.platforms.web;    // [{ url: 'https://app/<bech32>', entity: 'nevent' }]
 * ```
 */
export interface HandlerInformation {
  /** Handler author pubkey. */
  pubkey: string;
  /** `d`-tag identifier (handler instance id). */
  identifier: string;
  /** Addressable coordinate `31990:pubkey:d`. */
  address: string;
  /** Event kinds the handler declares support for (from `k` tags, de-duplicated). */
  kinds: number[];
  /** Parsed kind-0-style metadata from `content` (name, display_name, picture, about, …). `{}` if absent/invalid. */
  metadata: Record<string, unknown>;
  /** Per-platform URL templates, keyed by {@link HandlerPlatform}. Only platforms present in the event appear. */
  platforms: Partial<Record<HandlerPlatform, HandlerTarget[]>>;
}

/**
 * Parse a kind-31990 handler-information event.
 *
 * @param event - A kind-31990 event (kind is not re-validated)
 * @returns The structured handler information
 *
 * @example
 * ```ts
 * import { parseHandlerInformation, handlesKind } from '@kehto/nip/89';
 * const info = parseHandlerInformation(event);
 * if (handlesKind(info, 1)) openWith(info);
 * ```
 */
export function parseHandlerInformation(event: NostrEvent): HandlerInformation {
  let identifier = '';
  const kinds: number[] = [];
  const seenKinds = new Set<number>();
  const platforms: Partial<Record<HandlerPlatform, HandlerTarget[]>> = {};

  for (const tag of event.tags) {
    const name = tag[0];
    if (name === 'd') {
      identifier = tag[1] ?? '';
    } else if (name === 'k') {
      const k = Number(tag[1]);
      if (Number.isInteger(k) && !seenKinds.has(k)) {
        seenKinds.add(k);
        kinds.push(k);
      }
    } else if (PLATFORM_SET.has(name) && typeof tag[1] === 'string' && tag[1].length > 0) {
      const platform = name as HandlerPlatform;
      (platforms[platform] ??= []).push({ url: tag[1], entity: tag[2] });
    }
  }

  return {
    pubkey: event.pubkey,
    identifier,
    address: `${HANDLER_INFORMATION_KIND}:${event.pubkey}:${identifier}`,
    kinds,
    metadata: parseJsonObject(event.content),
    platforms,
  };
}

/**
 * Whether a handler declares support for `kind`.
 *
 * @param info - Parsed handler information
 * @param kind - Event kind to check
 */
export function handlesKind(info: HandlerInformation, kind: number): boolean {
  return info.kinds.includes(kind);
}

/**
 * Substitution values for {@link buildHandlerUrl}.
 *
 * NIP-89 templates use `<bech32>` (NIP-19 encoded entity) and/or `<raw>`
 * (hex id / address coordinate). Supply whichever the template needs.
 */
export interface HandlerEntityValues {
  /** NIP-19 bech32 entity (e.g. an `nevent…`, `naddr…`, `nprofile…`). */
  bech32?: string;
  /** Raw value (hex event id, or `kind:pubkey:d` coordinate). */
  raw?: string;
}

/**
 * Expand a handler URL template by substituting its `<bech32>` / `<raw>`
 * placeholders.
 *
 * Returns `undefined` when the template requires a placeholder you didn't
 * supply (e.g. it contains `<bech32>` but `values.bech32` is missing) — so a
 * caller can fall through to the next target instead of producing a broken URL.
 *
 * @param target - A {@link HandlerTarget} or a raw template string
 * @param values - The `<bech32>` / `<raw>` substitutions
 * @returns The expanded URL, or `undefined` if a needed placeholder is absent
 *
 * @example
 * ```ts
 * buildHandlerUrl({ url: 'https://app/e/<bech32>', entity: 'nevent' }, { bech32: 'nevent1…' });
 * // 'https://app/e/nevent1…'
 * ```
 */
export function buildHandlerUrl(target: HandlerTarget | string, values: HandlerEntityValues): string | undefined {
  const template = typeof target === 'string' ? target : target.url;
  if (template.includes('<bech32>') && values.bech32 === undefined) return undefined;
  if (template.includes('<raw>') && values.raw === undefined) return undefined;
  return template
    .replace(/<bech32>/g, values.bech32 ?? '')
    .replace(/<raw>/g, values.raw ?? '');
}

/** One handler endorsement parsed from a 31989 `a` tag. */
export interface HandlerRecommendationEntry {
  /** The recommended handler's 31990 coordinate `31990:pubkey:d`. */
  address: string;
  /** Handler author pubkey extracted from the coordinate, if well-formed. */
  handlerPubkey: string | undefined;
  /** Handler `d`-tag identifier extracted from the coordinate, if present. */
  identifier: string | undefined;
  /** Optional relay-hint where the 31990 event can be found (`a`-tag 3rd element). */
  relay: string | undefined;
  /** Optional platform marker the handler is recommended for (`a`-tag 4th element). */
  platform: string | undefined;
}

/**
 * A parsed kind-31989 handler-recommendation event.
 *
 * @example
 * ```ts
 * const rec = parseHandlerRecommendation(event);
 * rec.recommendedKind;          // 1
 * rec.recommendations[0].address; // '31990:pubkey:d'
 * ```
 */
export interface HandlerRecommendation {
  /** Recommendation author pubkey. */
  pubkey: string;
  /** The kind being recommended for, parsed from the `d` tag; `undefined` if non-numeric/missing. */
  recommendedKind: number | undefined;
  /** Endorsed handlers, in tag order. */
  recommendations: HandlerRecommendationEntry[];
}

/**
 * Parse a kind-31989 handler-recommendation event.
 *
 * The `d` tag carries the kind being recommended for; each `a` tag (whose
 * coordinate starts with `31990:`) endorses one handler, optionally with a
 * relay hint and platform marker.
 *
 * @param event - A kind-31989 event (kind is not re-validated)
 * @returns The structured recommendation
 */
export function parseHandlerRecommendation(event: NostrEvent): HandlerRecommendation {
  let recommendedKind: number | undefined;
  const recommendations: HandlerRecommendationEntry[] = [];

  for (const tag of event.tags) {
    if (tag[0] === 'd') {
      const k = Number(tag[1]);
      recommendedKind = Number.isInteger(k) ? k : undefined;
    } else if (tag[0] === 'a' && typeof tag[1] === 'string' && tag[1].startsWith(`${HANDLER_INFORMATION_KIND}:`)) {
      const [, handlerPubkey, identifier] = tag[1].split(':');
      recommendations.push({
        address: tag[1],
        handlerPubkey: handlerPubkey || undefined,
        identifier: identifier ?? undefined,
        relay: tag[2] || undefined,
        platform: tag[3] || undefined,
      });
    }
  }

  return { pubkey: event.pubkey, recommendedKind, recommendations };
}

function parseJsonObject(content: string): Record<string, unknown> {
  if (!content) return {};
  try {
    const parsed: unknown = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
