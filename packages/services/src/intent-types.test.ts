import { describe, expect, it } from 'vitest';
import type {
  IntentAvailability,
  IntentCandidate,
  IntentOpenOptions,
  IntentRequest,
  IntentResult,
} from '@napplet/core';

const OPTIONS = {
  convention: 'napplet:profile/open',
  handler: 'choose',
  behavior: { focus: true, reuse: false },
} satisfies IntentOpenOptions;

const REQUEST: IntentRequest = {
  archetype: 'profile',
  payload: { pubkey: 'abc123' },
  ...OPTIONS,
};

const CANDIDATE = {
  dTag: 'profile-viewer',
  title: 'Profile Viewer',
  actions: ['open'],
  conventions: ['napplet:profile/open'],
  isDefault: true,
} satisfies IntentCandidate;

const AVAILABILITY = {
  archetype: 'profile',
  available: true,
  candidates: [CANDIDATE],
  hasDefault: true,
} satisfies IntentAvailability;

const HANDLED = {
  ok: true,
  archetype: 'profile',
  action: 'open',
  handled: true,
  handler: 'profile-viewer',
  windowId: 'window-1',
  convention: 'napplet:profile/open',
} satisfies IntentResult;

const REJECTED = {
  ok: false,
  archetype: 'profile',
  action: 'open',
  handled: false,
  error: 'no handler',
} satisfies IntentResult;

describe('canonical NAP-INTENT value types', () => {
  it('supports the merged request, candidate, availability, and result shapes', () => {
    expect(REQUEST.action).toBeUndefined();
    expect(AVAILABILITY.candidates).toEqual([CANDIDATE]);
    expect(HANDLED).toMatchObject({
      handled: true,
      handler: 'profile-viewer',
      windowId: 'window-1',
    });
    expect(REJECTED).toMatchObject({ handled: false, error: 'no handler' });
  });
});
