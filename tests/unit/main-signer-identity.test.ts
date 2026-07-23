import { describe, expect, it, vi } from 'vitest';
import type { SignerConnectionStateView } from '../../apps/playground/src/topology.js';
import { createIdentityTransitionPublisher } from '../../apps/playground/src/main-signer.js';

const PUBKEY = 'a'.repeat(64);

function state(
  overrides: Partial<SignerConnectionStateView> = {},
): SignerConnectionStateView {
  return {
    method: 'none',
    pubkey: null,
    relay: null,
    isConnecting: false,
    error: null,
    recentRequests: [],
    ...overrides,
  };
}

describe('playground identity transitions', () => {
  it('publishes one normal transition, ignores repeats, then publishes one sign-out', () => {
    const publish = vi.fn();
    const onState = createIdentityTransitionPublisher(publish);

    onState(state());
    onState(state({ isConnecting: true }));
    onState(state({ method: 'nip07', pubkey: PUBKEY }));
    onState(state({ method: 'nip07', pubkey: PUBKEY }));
    onState(state({ method: 'nip07', pubkey: PUBKEY, isConnecting: true }));
    onState(state({ method: 'nip07', pubkey: PUBKEY }));
    onState(state());
    onState(state());

    expect(publish.mock.calls).toEqual([[PUBKEY], ['']]);
  });
});
