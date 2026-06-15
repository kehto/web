/**
 * firewall-dispatch.test.ts — Integration tests for @kehto/runtime firewall choke-point.
 *
 * Drives `runtime.handleMessage` end-to-end and asserts the firewall gate
 * behaves correctly for each named VERIFY-02 attack scenario.
 *
 * All assertions are VOLUME-BASED (assert flag/reject transitions appear at
 * the expected message index or ordering) — no wall-clock math, no exact
 * token arithmetic (now is real Date.now() through handleMessage).
 *
 * Attack coverage:
 *   1. Publish flood → flag then block as budget exhausts (burst guard)
 *   2. Init-burst → block (> DEFAULT_BURST_MAX_OPS in init window)
 *   3. Backgrounded (unfocused) + init-burst → tighter budget than focused
 *   4. kind-5 delete spam → content-matcher block
 *   5. ask policy → reject + consent handler fired + choice remembered (no re-prompt)
 *   6. Unfocused multiplier → rate limit flags sooner than focused
 *
 * Plus RUNTIME-04: a flagged op emits onFirewallEvent AND still dispatches.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';
import { DEFAULT_BURST_MAX_OPS } from '@kehto/firewall';

// ─── Constants ────────────────────────────────────────────────────────────────

const WINDOW_ID = 'fw-test-win-1';
const WINDOW_ID_2 = 'fw-test-win-2';
const TEST_DTAG = 'fw-test-napp';
const TEST_HASH = 'c'.repeat(64);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A well-formed kind-1 publish event for most flood/burst tests. */
const KIND1_EVENT = {
  id: '0'.repeat(64),
  pubkey: '0'.repeat(64),
  created_at: 0,
  kind: 1,
  tags: [],
  content: 'x',
  sig: '0'.repeat(128),
};

/** A well-formed kind-5 delete event for the content-matcher test. */
const KIND5_EVENT = {
  id: '0'.repeat(64),
  pubkey: '0'.repeat(64),
  created_at: 0,
  kind: 5,
  tags: [],
  content: '',
  sig: '0'.repeat(128),
};

/**
 * Build a relay.publish envelope.
 * @param i - Unique per-message ID suffix.
 * @param event - The Nostr event payload (defaults to KIND1_EVENT).
 */
function makePublish(i: number, event = KIND1_EVENT): NappletMessage {
  return { type: 'relay.publish', id: `p${i}`, event } as NappletMessage;
}

/**
 * Create a session entry with `registeredAt` offset by `msAgo` milliseconds
 * into the past. Used to bypass the init-burst window when `msAgo` exceeds
 * DEFAULT_BURST_WINDOW_MS (3000ms).
 */
function makeSessionEntryAged(windowId: string, msAgo = 0): ReturnType<typeof createNip5dSessionEntry> {
  const entry = createNip5dSessionEntry(windowId, TEST_DTAG, TEST_HASH);
  (entry as { registeredAt: number }).registeredAt = Date.now() - msAgo;
  return entry;
}

/**
 * Find the first message index (0-based) at which a `relay.publish.error`
 * appears in `sent`. Returns -1 if no error was found.
 */
function firstRejectIndex(sent: MockRuntimeContext['sent']): number {
  for (let i = 0; i < sent.length; i++) {
    const msg = sent[i].message;
    if (
      typeof msg === 'object' &&
      msg !== null &&
      !Array.isArray(msg) &&
      (msg as NappletMessage).type === 'relay.publish.error'
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Count all `relay.publish.error` envelopes in `sent`.
 */
function countErrors(sent: MockRuntimeContext['sent']): number {
  return sent.filter(
    (s) =>
      typeof s.message === 'object' &&
      s.message !== null &&
      !Array.isArray(s.message) &&
      (s.message as NappletMessage).type === 'relay.publish.error',
  ).length;
}

// ─── Firewall Integration — Publish Flood & Burst ──────────────────────────────

describe('firewall integration — publish flood and burst guard', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    // Session registered now → initElapsedMs is tiny (within burst window)
    runtime.sessionRegistry.register(WINDOW_ID, makeSessionEntryAged(WINDOW_ID, 0));
  });

  // ── Attack 1: Publish flood → flag then block ─────────────────────────────

  it('publish flood: burst guard blocks after DEFAULT_BURST_MAX_OPS within the init window', () => {
    // Fire DEFAULT_BURST_MAX_OPS + 5 messages in a tight synchronous loop.
    // All messages are within the init window (registeredAt = now).
    // Burst guard fires after message DEFAULT_BURST_MAX_OPS (20) → decision: reject.
    const N = DEFAULT_BURST_MAX_OPS + 5;
    for (let i = 0; i < N; i++) {
      runtime.handleMessage(WINDOW_ID, makePublish(i));
    }

    // At least one relay.publish.error must appear (burst guard blocked)
    const err = findEnvelopeResponse(ctx.sent, 'relay.publish.error');
    expect(err, 'Expected relay.publish.error after burst guard fires').toBeDefined();
  });

  it('publish flood: messages before burst guard fires are dispatched (not rejected)', () => {
    // Send exactly DEFAULT_BURST_MAX_OPS messages — burst guard count should be
    // exactly maxOps (not exceeded yet), so all messages must dispatch (no error).
    for (let i = 0; i < DEFAULT_BURST_MAX_OPS; i++) {
      runtime.handleMessage(WINDOW_ID, makePublish(i));
    }

    expect(
      findEnvelopeResponse(ctx.sent, 'relay.publish.error'),
      'Expected NO error for messages within the burst limit',
    ).toBeUndefined();
  });

  it('publish flood: flag → block transition — the reject envelope appears AFTER earlier dispatched messages', () => {
    // Send 200 messages. The first DEFAULT_BURST_MAX_OPS (20) dispatch, then burst
    // guard fires. We assert: (a) reject appears, (b) the reject index > 0 (i.e.,
    // some messages dispatched before the block — flag then block ordering).
    for (let i = 0; i < 200; i++) {
      runtime.handleMessage(WINDOW_ID, makePublish(i));
    }

    const rejectIdx = firstRejectIndex(ctx.sent);
    expect(rejectIdx, 'Expected at least one relay.publish.error').toBeGreaterThan(-1);
    // Messages before the reject were dispatched (relay.publish.result or no error)
    expect(rejectIdx, 'Expected some messages to dispatch before the block').toBeGreaterThan(0);
  });

  // ── Attack 2: Init-burst → block ─────────────────────────────────────────

  it('init-burst: fires > DEFAULT_BURST_MAX_OPS envelopes → burst guard blocks', () => {
    const N = DEFAULT_BURST_MAX_OPS + 1;
    for (let i = 0; i < N; i++) {
      runtime.handleMessage(WINDOW_ID, makePublish(i));
    }
    const err = findEnvelopeResponse(ctx.sent, 'relay.publish.error');
    expect(err).toBeDefined();
    expect((err as any).error).toMatch(/firewall:/);
  });
});

// ─── Firewall Integration — Backgrounded (Unfocused) Burst ──────────────────

describe('firewall integration — backgrounded (unfocused) burst', () => {
  // ── Attack 3: Backgrounded + init-burst → block (sharper rate drain) ─────

  it('unfocused napplet rejects no later than focused napplet under burst flood', () => {
    // Run two runtimes: one focused (default), one unfocused.
    // Fire DEFAULT_BURST_MAX_OPS + 5 messages through each.
    // The unfocused reject must appear no later (lower or equal index) than focused.
    // Burst guard (index 21) fires for both, so equality is the common outcome —
    // but the unfocused rate budget drains faster within the burst window.
    const FLOOD = DEFAULT_BURST_MAX_OPS + 5;

    const ctxFocused = createMockRuntimeAdapter();
    const runtimeFocused = createRuntime(ctxFocused.hooks);
    runtimeFocused.sessionRegistry.register(WINDOW_ID, makeSessionEntryAged(WINDOW_ID, 0));

    const ctxUnfocused = createMockRuntimeAdapter({
      getFocusContext: () => ({ focused: false }),
    });
    const runtimeUnfocused = createRuntime(ctxUnfocused.hooks);
    runtimeUnfocused.sessionRegistry.register(WINDOW_ID, makeSessionEntryAged(WINDOW_ID, 0));

    for (let i = 0; i < FLOOD; i++) {
      runtimeFocused.handleMessage(WINDOW_ID, makePublish(i));
      runtimeUnfocused.handleMessage(WINDOW_ID, makePublish(i));
    }

    const focusedRejectIdx = firstRejectIndex(ctxFocused.sent);
    const unfocusedRejectIdx = firstRejectIndex(ctxUnfocused.sent);

    // Both should have at least one reject
    expect(focusedRejectIdx, 'Focused: expected a reject').toBeGreaterThan(-1);
    expect(unfocusedRejectIdx, 'Unfocused: expected a reject').toBeGreaterThan(-1);

    // Unfocused budget is tighter — must reject no later than focused
    expect(
      unfocusedRejectIdx,
      `Unfocused reject (idx ${unfocusedRejectIdx}) must be ≤ focused reject (idx ${focusedRejectIdx})`,
    ).toBeLessThanOrEqual(focusedRejectIdx);
  });
});

// ─── Firewall Integration — RUNTIME-04 Flag Dispatches and Audits ────────────

describe('firewall integration — RUNTIME-04 flag dispatches and audits', () => {
  it('a flagged op emits onFirewallEvent AND still dispatches the message', () => {
    // Configure a tight rate limit with action: 'flag' so the budget exhausts quickly.
    // Use an AGED session (bypass burst guard) and a small capacity (1 token).
    // Message 1: within budget → passes (action: ignore, no audit).
    // Message 2: budget empty → action: flag → pass + onFirewallEvent.
    const firewallEventSpy = vi.fn();
    const ctx2 = createMockRuntimeAdapter({ onFirewallEvent: firewallEventSpy });
    const runtime2 = createRuntime(ctx2.hooks);
    // Set registeredAt far enough in the past to skip the burst guard window (>3000ms)
    runtime2.sessionRegistry.register(WINDOW_ID_2, makeSessionEntryAged(WINDOW_ID_2, 10_000));

    // Set a tiny per-napplet rate limit with action: 'flag' to exhaust quickly
    runtime2.firewallState.setRateLimit(TEST_DTAG, 'relay:write', {
      capacity: 1,
      windowMs: 60_000,
      action: 'flag',
    });

    // Message 1: within budget — dispatches, no audit
    runtime2.handleMessage(WINDOW_ID_2, makePublish(0));
    const result1 = findEnvelopeResponse(ctx2.sent, 'relay.publish.result');
    // relay.publish dispatches but returns accepted:false (no relay pool) — that's fine,
    // the important thing is there is NO error envelope (i.e., message was dispatched).
    const err1 = findEnvelopeResponse(ctx2.sent, 'relay.publish.error');
    expect(err1, 'Message 1 should dispatch — no firewall error').toBeUndefined();

    // Reset for message 2
    ctx2.sent.length = 0;

    // Message 2: budget empty → action: 'flag' → dispatches AND fires onFirewallEvent
    runtime2.handleMessage(WINDOW_ID_2, makePublish(1));

    // Flag action still dispatches — no relay.publish.error
    const err2 = findEnvelopeResponse(ctx2.sent, 'relay.publish.error');
    expect(err2, 'Flagged message must NOT be dropped — flag still dispatches').toBeUndefined();

    // Flag action fires onFirewallEvent
    expect(firewallEventSpy, 'onFirewallEvent must be called for flag action').toHaveBeenCalled();
    const event = firewallEventSpy.mock.calls[0][0];
    expect(event.action).toBe('flag');
    expect(event.decision).toBe('pass');
    expect(event.napplet).toBe(TEST_DTAG);
  });
});

// ─── Firewall Integration — kind-5 Delete Spam ───────────────────────────────

describe('firewall integration — kind-5 delete spam (CONTENT-03)', () => {
  // ── Attack 4: kind-5 delete spam → content matcher fires ─────────────────

  it('kind-5 delete event triggers content-matcher block', () => {
    const ctx3 = createMockRuntimeAdapter();
    const runtime3 = createRuntime(ctx3.hooks);
    // Aged session: bypass burst guard
    runtime3.sessionRegistry.register(WINDOW_ID, makeSessionEntryAged(WINDOW_ID, 10_000));

    // Add a content matcher: opClass relay:write + kind 5 → block
    runtime3.firewallState.addMatcher({
      id: 'delete-spam',
      opClass: 'relay:write',
      kinds: [5],
      action: 'block',
    });

    // Fire a kind-5 publish
    runtime3.handleMessage(WINDOW_ID, makePublish(0, KIND5_EVENT));

    const err = findEnvelopeResponse(ctx3.sent, 'relay.publish.error');
    expect(err, 'Expected relay.publish.error for kind-5 match').toBeDefined();
    expect((err as any).error).toMatch(/firewall:/);
  });

  it('kind-1 event is NOT blocked by the kind-5 content matcher', () => {
    const ctx3 = createMockRuntimeAdapter();
    const runtime3 = createRuntime(ctx3.hooks);
    runtime3.sessionRegistry.register(WINDOW_ID, makeSessionEntryAged(WINDOW_ID, 10_000));

    runtime3.firewallState.addMatcher({
      id: 'delete-spam',
      opClass: 'relay:write',
      kinds: [5],
      action: 'block',
    });

    // Fire a kind-1 publish — must not be blocked
    runtime3.handleMessage(WINDOW_ID, makePublish(0, KIND1_EVENT));

    expect(
      findEnvelopeResponse(ctx3.sent, 'relay.publish.error'),
      'kind-1 must NOT be blocked by kind-5 matcher',
    ).toBeUndefined();
  });
});

// ─── Firewall Integration — ask Policy: Consent Flow (POLICY-02) ─────────────

describe('firewall integration — ask policy: reject + consent + remembered (POLICY-02)', () => {
  // ── Attack 5: ask → reject current + consent handler fired + no re-prompt ─

  it('ask policy: first message rejected, consent handler called exactly once, second message dispatches', () => {
    const ctx4 = createMockRuntimeAdapter();
    const runtime4 = createRuntime(ctx4.hooks);
    // Aged session: bypass burst guard
    runtime4.sessionRegistry.register(WINDOW_ID, makeSessionEntryAged(WINDOW_ID, 10_000));

    // Pre-set policy to 'ask' via the firewallState getter
    runtime4.firewallState.setPolicy(TEST_DTAG, 'ask');

    // Track consent handler calls
    const consentCalls: Array<{
      type?: string;
      napplet?: string;
      resolve: (allowed: boolean) => void;
    }> = [];

    runtime4.registerConsentHandler((req) => {
      consentCalls.push(req as typeof consentCalls[0]);
      // Immediately resolve with 'allow' — simulates user clicking "allow"
      req.resolve(true);
    });

    // Message 1: should be rejected (ask policy → reject + fire consent)
    runtime4.handleMessage(WINDOW_ID, makePublish(0));

    const err1 = findEnvelopeResponse(ctx4.sent, 'relay.publish.error');
    expect(err1, 'First message under ask policy must be rejected').toBeDefined();
    expect((err1 as any).error).toMatch(/firewall:/);

    // Consent handler must have fired exactly once
    expect(consentCalls.length, 'Consent handler must be called exactly once for the first message').toBe(1);
    expect(consentCalls[0].type).toBe('firewall-policy');
    expect(consentCalls[0].napplet).toBe(TEST_DTAG);

    // After resolve(true), policy is remembered as 'allow'
    // Clear sent messages so we can inspect message 2 in isolation
    ctx4.sent.length = 0;

    // Message 2: policy resolved to 'allow', must dispatch (no error, no re-prompt)
    runtime4.handleMessage(WINDOW_ID, makePublish(1));

    const err2 = findEnvelopeResponse(ctx4.sent, 'relay.publish.error');
    expect(err2, 'Second message should dispatch after consent resolved to allow').toBeUndefined();

    // Consent handler must NOT be called a second time (no re-prompt — remembered)
    expect(consentCalls.length, 'Consent handler must NOT be called again after policy is remembered').toBe(1);
  });

  it('ask policy with no consent handler: first message still rejected (fireConsent no-op)', () => {
    const ctx4b = createMockRuntimeAdapter();
    const runtime4b = createRuntime(ctx4b.hooks);
    runtime4b.sessionRegistry.register(WINDOW_ID, makeSessionEntryAged(WINDOW_ID, 10_000));

    runtime4b.firewallState.setPolicy(TEST_DTAG, 'ask');
    // No consent handler registered

    runtime4b.handleMessage(WINDOW_ID, makePublish(0));

    // Message is still rejected (prompt → drop)
    const err = findEnvelopeResponse(ctx4b.sent, 'relay.publish.error');
    expect(err, 'ask policy with no handler: message must still be rejected').toBeDefined();
  });
});

// ─── Firewall Integration — Unfocused Multiplier (FOCUS-01/FOCUS-02) ──────────

describe('firewall integration — unfocused multiplier tightens rate budget (FOCUS-01/FOCUS-02)', () => {
  // ── Attack 6: unfocused → rate limit exhausts at fewer messages than focused ─

  it('unfocused napplet rate budget exhausts sooner than focused napplet', () => {
    // Bypass burst guard by using aged sessions (>3000ms old).
    // Default rate: capacity=60, action='flag', windowMs=60000.
    // Focused effective capacity: 60.  Unfocused: 60 * 0.25 = 15.
    //
    // Drive 70 messages through each runtime.
    //   Focused:   messages 1-60 pass (within budget), messages 61-70 → flag (audit+dispatch).
    //   Unfocused: messages 1-15 pass (within budget), messages 16-70 → flag (audit+dispatch).
    //
    // Assert: unfocused onFirewallEvent fires MORE times (or sooner) than focused.
    const FLOOD = 70;

    const focusedSpy = vi.fn();
    const ctxFocused2 = createMockRuntimeAdapter({ onFirewallEvent: focusedSpy });
    const runtimeFocused2 = createRuntime(ctxFocused2.hooks);
    runtimeFocused2.sessionRegistry.register(WINDOW_ID, makeSessionEntryAged(WINDOW_ID, 10_000));

    const unfocusedSpy = vi.fn();
    const ctxUnfocused2 = createMockRuntimeAdapter({
      onFirewallEvent: unfocusedSpy,
      getFocusContext: () => ({ focused: false }),
    });
    const runtimeUnfocused2 = createRuntime(ctxUnfocused2.hooks);
    runtimeUnfocused2.sessionRegistry.register(WINDOW_ID, makeSessionEntryAged(WINDOW_ID, 10_000));

    for (let i = 0; i < FLOOD; i++) {
      runtimeFocused2.handleMessage(WINDOW_ID, makePublish(i));
      runtimeUnfocused2.handleMessage(WINDOW_ID, makePublish(i));
    }

    // Both runtimes should have flag events (rate exceeded)
    expect(
      unfocusedSpy.mock.calls.length,
      'Unfocused runtime must produce flag events (rate exceeded sooner)',
    ).toBeGreaterThan(0);

    // Unfocused must flag MORE messages (tighter budget → more flag events)
    expect(
      unfocusedSpy.mock.calls.length,
      `Unfocused (${unfocusedSpy.mock.calls.length} flags) must flag more than focused (${focusedSpy.mock.calls.length} flags)`,
    ).toBeGreaterThan(focusedSpy.mock.calls.length);
  });

  it('unfocused napplet: flag action still dispatches (focus alone never hard-blocks — FOCUS-02)', () => {
    // Even when over the unfocused rate budget (flag action), the message MUST dispatch.
    const unfocusedSpy = vi.fn();
    const ctx5 = createMockRuntimeAdapter({
      onFirewallEvent: unfocusedSpy,
      getFocusContext: () => ({ focused: false }),
    });
    const runtime5 = createRuntime(ctx5.hooks);
    runtime5.sessionRegistry.register(WINDOW_ID, makeSessionEntryAged(WINDOW_ID, 10_000));

    // Fire 20 messages: unfocused capacity is 15, so messages 16-20 will flag.
    for (let i = 0; i < 20; i++) {
      runtime5.handleMessage(WINDOW_ID, makePublish(i));
    }

    // There must be flag audit events
    expect(unfocusedSpy.mock.calls.length, 'Expected flag audit events for unfocused rate exceed').toBeGreaterThan(0);

    // ALL audit events must be 'flag' action (pass+audit), never 'block'
    for (const call of unfocusedSpy.mock.calls) {
      expect(call[0].action, 'Unfocused flag must be action: flag (not block)').toBe('flag');
      expect(call[0].decision, 'Unfocused flag decision must be pass (not reject)').toBe('pass');
    }

    // No relay.publish.error (flagged messages dispatched — not rejected)
    expect(
      findEnvelopeResponse(ctx5.sent, 'relay.publish.error'),
      'Unfocused flag must not drop messages (FOCUS-02 invariant)',
    ).toBeUndefined();
  });
});
