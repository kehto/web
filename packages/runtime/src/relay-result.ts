import type { NostrEvent } from '@napplet/core';
import type { ResourceSidecarEntry } from '@napplet/nap/resource/types';

/** Metadata attached to a raw Nostr event read result. */
export interface RelayEventSidecar {
  /** Pre-resolved resources owned by NAP-RESOURCE policy. */
  resources?: ResourceSidecarEntry[];
  /** Advisory relays where the shell observed the event or expects follow-up reads to work. */
  relayHints?: string[];
}

/** Raw event plus optional read-side metadata, shared by read-style NAP surfaces. */
export interface RelayEventResult {
  /** Raw Nostr event. */
  event: NostrEvent;
  /** Optional runtime-observed sidecar metadata. */
  sidecar?: RelayEventSidecar;
}

/** Relay event envelope shape accepted during the result-shape migration. */
export interface RelayEventCarrier {
  result?: unknown;
  event?: unknown;
  sidecar?: unknown;
  resources?: unknown;
  relay?: unknown;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))];
  return out.length > 0 ? out : undefined;
}

function sidecarFromUnknown(value: unknown): RelayEventSidecar | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as RelayEventSidecar;
  const sidecar: RelayEventSidecar = {};
  if (Array.isArray(input.resources) && input.resources.length > 0) sidecar.resources = input.resources;
  const relayHints = stringList(input.relayHints);
  if (relayHints) sidecar.relayHints = relayHints;
  return sidecar.resources || sidecar.relayHints ? sidecar : undefined;
}

/** Build a canonical relay event result, omitting an empty sidecar. */
export function createRelayEventResult(event: NostrEvent, sidecar?: RelayEventSidecar): RelayEventResult {
  const normalized = sidecarFromUnknown(sidecar);
  return normalized ? { event, sidecar: normalized } : { event };
}

/** Build a relay event result with advisory relay hints. */
export function createRelayEventResultWithHints(event: NostrEvent, relayHints?: string[]): RelayEventResult {
  return createRelayEventResult(event, relayHints && relayHints.length > 0 ? { relayHints } : undefined);
}

/**
 * Read either the current `result` wire shape or the pre-result migration shape.
 * This keeps internal service composition working while emitters move to
 * canonical `RelayEventResult` envelopes.
 */
export function relayEventResultFromCarrier(carrier: RelayEventCarrier): RelayEventResult | null {
  if (carrier.result && typeof carrier.result === 'object') {
    const result = carrier.result as RelayEventResult;
    if (result.event && typeof result.event === 'object') return createRelayEventResult(result.event, result.sidecar);
  }
  if (carrier.event && typeof carrier.event === 'object') {
    const sidecar = sidecarFromUnknown(carrier.sidecar) ?? sidecarFromUnknown({ resources: carrier.resources });
    const relayHints = typeof carrier.relay === 'string' && carrier.relay.length > 0 ? [carrier.relay] : undefined;
    const merged: RelayEventSidecar = sidecar ? { ...sidecar } : {};
    if (relayHints) merged.relayHints = relayHints;
    return createRelayEventResult(carrier.event as NostrEvent, merged);
  }
  return null;
}
