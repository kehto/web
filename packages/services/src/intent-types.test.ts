import { describe, expect, expectTypeOf, it } from 'vitest';
import type { IntentCandidate, IntentDelivery, IntentRequest, IntentResult } from './intent-types.js';

describe('canonical intent contracts', () => {
  it('keeps the current draft delivery shape despite core 0.40 type drift', () => {
    // naps PR #128 @ 74f9bf85 withdraws delivery IDs and null shell senders.
    // napplet/web#328 tracks the published core 0.40 mismatch.
    const delivery = {
      sender: 'catalog-viewer', archetype: 'profile', action: 'open',
      convention: 'napplet:profile/open',
    } satisfies IntentDelivery;
    expectTypeOf<IntentDelivery['sender']>().toEqualTypeOf<string>();
    expectTypeOf<Extract<keyof IntentDelivery, 'id'>>().toEqualTypeOf<never>();
    expect(delivery).not.toHaveProperty('id');
  });

  it('requires URI-normalized routing fields and excludes lifecycle internals', () => {
    const request = { archetype: 'profile', action: 'open', convention: 'napplet:profile/open', handlerHint: { address: `35129:${'a'.repeat(64)}:Viewer` } } satisfies IntentRequest;
    const candidate = { id: 'nip5d:35129:publisher:Viewer', actions: ['open'], conventions: ['napplet:profile/open'], contracts: [{ convention: 'napplet:profile/open', params: ['pubkey'] }] } satisfies IntentCandidate;
    const result = { ok: true, archetype: 'profile', action: 'open', convention: 'napplet:profile/open', handler: candidate.id } satisfies IntentResult;
    expect(JSON.stringify({ request, candidate, result })).not.toMatch(/dTag|handled|windowId|newWindow/);
  });
});
