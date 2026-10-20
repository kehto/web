/** Legacy temporal Firewall ingress kept for hosts without permission adapters. */
import type { NappletMessage } from '@napplet/core';
import type { Observation } from '@kehto/firewall';
import type { RuntimeAdapter, FirewallEvent } from './types.js';
import type { SessionRegistry } from './session-registry.js';
import type { FirewallStateContainer } from './firewall-state.js';
import { createCanonicalDomainResult, createIntentPolicyDenial } from './domain-results.js';

declare const console: { warn(message: string): void };

/**
 * Compute the UTF-8 byte length of a string without TextEncoder (ES2022-safe).
 * Mirrors the same helper in state-handler.ts to avoid cross-file import.
 */
function utf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c < 0xd800 || c >= 0xe000) bytes += 3;
    else { i++; bytes += 4; } // surrogate pair
  }
  return bytes;
}

/**
 * Extract kind and byte-size from a message envelope (publish-style ops only).
 * Guards against malformed envelopes — returns undefined fields on any failure.
 *
 * @param envelope - Incoming NappletMessage envelope.
 * @returns `{ kind?, size? }` — both optional; undefined when not a publish-style op.
 */
function extractKindSize(envelope: NappletMessage): { kind?: number; size?: number } {
  const ev = (envelope as NappletMessage & { event?: unknown }).event;
  if (typeof ev !== 'object' || ev === null) return {};
  const kind = typeof (ev as { kind?: unknown }).kind === 'number'
    ? (ev as { kind: number }).kind
    : undefined;
  let size: number | undefined;
  try {
    size = utf8ByteLength(JSON.stringify(ev));
  } catch { /* malformed event — size stays undefined */ }
  return { kind, size };
}

/**
 * Build a normalized Observation from a message envelope and runtime context.
 * The runtime owns the clock (Date.now()); the pure engine never reads it.
 * Focus is sourced exclusively via getFocusContext (FOCUS-01) — never napplet-self-reported.
 * When getFocusContext is absent, defaults to `{ focused: true }` (safe relax-only default).
 *
 * @param envelope        - Incoming NappletMessage envelope.
 * @param windowId        - Source napplet window identifier.
 * @param senderCap       - Resolved sender capability string (or null).
 * @param sessionRegistry - Used to resolve dTag and registeredAt for the window.
 * @param getFocusContext  - Optional shell-supplied focus query hook.
 * @returns A complete Observation ready for evaluate().
 */
function buildObservation(
  envelope: NappletMessage,
  windowId: string,
  senderCap: string | null,
  sessionRegistry: SessionRegistry,
  getFocusContext?: RuntimeAdapter['getFocusContext'],
): Observation {
  const now = Date.now();
  const entry = sessionRegistry.getEntryByWindowId(windowId);
  const napplet = entry?.dTag ?? '';
  const initElapsedMs = now - (entry?.registeredAt ?? now);
  const focus = getFocusContext?.(windowId) ?? { focused: true };
  const opClass = senderCap ?? envelope.type;
  const { kind, size } = extractKindSize(envelope);
  return {
    napplet,
    opClass,
    kind,
    size,
    initElapsedMs,
    // `windowId` comes from the host's source-bound session lookup, never the
    // napplet message envelope. Trusted register() calls retire this key's
    // previous startup budget; ordinary messages cannot reset it.
    initKey: windowId,
    focused: focus.focused,
    msSinceFocusGain: focus.msSinceFocusGain,
    now,
  };
}

/** Configuration for createFirewallGate. */
interface FirewallGateConfig {
  firewallState: FirewallStateContainer;
  sessionRegistry: SessionRegistry;
  hooks: RuntimeAdapter;
  fireConsent: (windowId: string, napplet: string) => void;
}

/**
 * Create the firewall gate closure to inject into createMessageHandler.
 * Returns 'dispatch' to allow the message through or 'drop' to reject it.
 *
 * Decision→action mapping (RUNTIME-01, RUNTIME-04, POLICY-02):
 *   - reject → error envelope + drop (no dispatch)
 *   - prompt → error envelope + fireConsent + drop (ask path)
 *   - pass + flag → onFirewallEvent audit + dispatch
 *   - pass (ignore/allow) → dispatch (no audit)
 *
 * @param config - Gate configuration (firewallState, sessionRegistry, hooks, fireConsent).
 * @returns A gate function `(windowId, envelope, senderCap) => 'dispatch' | 'drop'`.
 */
export function createFirewallGate(config: FirewallGateConfig): (windowId: string, envelope: NappletMessage, senderCap: string | null, respond?: boolean) => 'dispatch' | 'drop' {
  const { firewallState, sessionRegistry, hooks, fireConsent } = config;
  let warned = false;

  return function firewallGate(windowId: string, envelope: NappletMessage, senderCap: string | null, respond = true): 'dispatch' | 'drop' {
    if (!warned) {
      warned = true;
      console.warn('FW-RUNTIME-LEGACY-GATE-001: the legacy temporal Firewall gate is active; configure RuntimeAdapter.permissions for scoped Firewall approvals and independent rate limits (warns once per runtime instance; retained through the next minor release).');
    }
    const obs = buildObservation(envelope, windowId, senderCap, sessionRegistry, hooks.getFocusContext);
    const result = firewallState.evaluate(obs);
    const { decision, action, ruleId, reason } = result;
    const napplet = obs.napplet;
    const opClass = obs.opClass;

    if (decision === 'reject' || decision === 'prompt') {
      if (!respond) {
        // Extension error contracts are host-owned; do not invent wire replies.
        hooks.onFirewallEvent?.({ windowId, napplet, opClass, decision, action, ruleId, reason, message: envelope } as FirewallEvent);
        if (decision === 'prompt') fireConsent(windowId, napplet);
        return 'drop';
      }
      const intentDenial = createIntentPolicyDenial(envelope);
      if (intentDenial) {
        hooks.sendToNapplet(windowId, intentDenial);
        hooks.onFirewallEvent?.({ windowId, napplet, opClass, decision, action, ruleId, reason, message: envelope } as FirewallEvent);
        if (decision === 'prompt') fireConsent(windowId, napplet);
        return 'drop';
      }

      const canonicalResult = createCanonicalDomainResult(envelope);
      if (canonicalResult) {
        hooks.sendToNapplet(windowId, canonicalResult);
        hooks.onFirewallEvent?.({ windowId, napplet, opClass, decision, action, ruleId, reason, message: envelope } as FirewallEvent);
        if (decision === 'prompt') fireConsent(windowId, napplet);
        return 'drop';
      }

      const denial = createDenialResponse(envelope, `firewall: ${reason}`);
      if (denial) hooks.sendToNapplet(windowId, denial);

      hooks.onFirewallEvent?.({ windowId, napplet, opClass, decision, action, ruleId, reason, message: envelope } as FirewallEvent);

      if (decision === 'prompt') {
        // POLICY-02: reject current message AND fire async consent prompt
        fireConsent(windowId, napplet);
      }
      return 'drop';
    }

    // decision === 'pass'
    if (action === 'flag') {
      // RUNTIME-04: flag → audit + dispatch (message is NOT dropped)
      hooks.onFirewallEvent?.({ windowId, napplet, opClass, decision, action, ruleId, reason, message: envelope } as FirewallEvent);
    }
    return 'dispatch';
  };
}

function denialResponseType(envelope: NappletMessage): string | null {
  if (envelope.type.startsWith('intent.')) return null;
  if (envelope.type.startsWith('storage.')) return `${envelope.type}.result`;
  if (envelope.type === 'inc.subscribe' || envelope.type === 'inc.channel.open') {
    return `${envelope.type}.result`;
  }
  if (envelope.type.startsWith('inc.')) return null;
  return `${envelope.type}.error`;
}

export function createDenialResponse(envelope: NappletMessage, error: string): NappletMessage | null {
  const id = (envelope as NappletMessage & { id?: string }).id ?? '';
  if (envelope.type === 'outbox.query') {
    return {
      type: 'outbox.query.result',
      id,
      events: [],
      error,
    } as NappletMessage;
  }
  const type = denialResponseType(envelope);
  return type ? { type, id, error } as NappletMessage : null;
}

