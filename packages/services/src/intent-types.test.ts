import { describe, expect, expectTypeOf, it } from 'vitest';
import type * as Core from '@napplet/core';
import type { IntentCandidate, IntentDelivery, IntentRequest, IntentResult } from './intent-types.js';

describe('canonical intent contracts', () => {
  it('re-exports the published core contracts unchanged (kehto/web#418)', () => {
    expectTypeOf<IntentDelivery>().toEqualTypeOf<Core.IntentDelivery>();
    expectTypeOf<IntentRequest>().toEqualTypeOf<Core.IntentRequest>();
    expectTypeOf<IntentCandidate>().toEqualTypeOf<Core.IntentCandidate>();
    expectTypeOf<IntentResult>().toEqualTypeOf<Core.IntentResult>();
  });

  it('keeps the no-ID, string-sender delivery from NAP-INTENT PR #128 @ 74f9bf85', () => {
    // Core 0.41.0 (napplet/web#329) dropped the withdrawn delivery ID and null sender.
    const delivery = {
      sender: 'catalog-viewer', archetype: 'profile', action: 'open',
      convention: 'napplet:profile/open',
    } satisfies IntentDelivery;
    expectTypeOf<IntentDelivery['sender']>().toEqualTypeOf<string>();
    expectTypeOf<Extract<keyof IntentDelivery, 'id'>>().toEqualTypeOf<never>();
    // @ts-expect-error a null sender is not part of the delivery contract
    const nullSender: IntentDelivery = { ...delivery, sender: null };
    // @ts-expect-error the withdrawn delivery ID is rejected
    const withId: IntentDelivery = { ...delivery, id: 'delivery-1' };
    expect([nullSender, withId]).toHaveLength(2);
    expect(delivery).not.toHaveProperty('id');
  });

  it('requires URI-normalized routing fields and excludes lifecycle internals', () => {
    const request = { archetype: 'profile', action: 'open', convention: 'napplet:profile/open', handlerHint: { address: `35129:${'a'.repeat(64)}:Viewer` } } satisfies IntentRequest;
    const candidate = { id: 'nip5d:35129:publisher:Viewer', actions: ['open'], conventions: ['napplet:profile/open'], contracts: [{ convention: 'napplet:profile/open', params: ['pubkey'] }] } satisfies IntentCandidate;
    const result = { ok: true, archetype: 'profile', action: 'open', convention: 'napplet:profile/open', handler: candidate.id } satisfies IntentResult;
    expect(JSON.stringify({ request, candidate, result })).not.toMatch(/dTag|handled|windowId|newWindow/);
  });
});
