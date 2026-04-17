/**
 * signer-demo.ts — Mock ephemeral signer for the demo host.
 *
 * Provides a demo keypair for `ShellAdapter.auth.getSigner`. The shell
 * consumes this signer internally to sign `relay.publish` envelopes per
 * NIP-5D — napplets never see the signer directly (NIP-5D MUST NOT
 * clause, see D-01 / D-02).
 *
 * No `window.nostr`, no `signer-service`, no BusKind.SIGNER_* — all of
 * those were removed in v1.2. Signing happens inside the shell's
 * `relay.publish` handler, not as a separate kind 29001/29002 flow.
 */

import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';

// Generate a demo host keypair (this represents the "user's" key)
const hostSecretKey = generateSecretKey();
const hostPubkey = getPublicKey(hostSecretKey);

/**
 * Create auth hook overrides that provide a demo signer implementation.
 * The signer uses a demo keypair, not a real end-user identity.
 */
export function createSignerHooks(): {
  getUserPubkey: () => string;
  getSigner: () => {
    getPublicKey: () => Promise<string>;
    signEvent: (event: Parameters<typeof finalizeEvent>[0]) => Promise<ReturnType<typeof finalizeEvent>>;
  };
} {
  return {
    getUserPubkey: () => hostPubkey,
    getSigner: () => ({
      getPublicKey: async () => hostPubkey,
      signEvent: async (event) => {
        // Sign with the demo host key
        return finalizeEvent(event, hostSecretKey);
      },
    }),
  };
}

/**
 * Get the demo host pubkey for display in the UI.
 */
export function getDemoHostPubkey(): string {
  return hostPubkey;
}
