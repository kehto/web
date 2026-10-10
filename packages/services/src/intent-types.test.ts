import { describe, expect, it } from 'vitest';
import type { IntentCandidate, IntentRequest, IntentResult } from './intent-types.js';

describe('canonical intent contracts', () => {
  it('requires URI-normalized routing fields and excludes lifecycle internals', () => {
    const request = { archetype: 'profile', action: 'open', convention: 'napplet:profile/open', handlerHint: { address: `35129:${'a'.repeat(64)}:Viewer` } } satisfies IntentRequest;
    const candidate = { id: 'nip5d:35129:publisher:Viewer', actions: ['open'], conventions: ['napplet:profile/open'], contracts: [{ convention: 'napplet:profile/open', params: ['pubkey'] }] } satisfies IntentCandidate;
    const result = { ok: true, archetype: 'profile', action: 'open', convention: 'napplet:profile/open', handler: candidate.id } satisfies IntentResult;
    expect(JSON.stringify({ request, candidate, result })).not.toMatch(/dTag|handled|windowId|newWindow/);
  });
});
