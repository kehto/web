/**
 * playground-cvm-transport.ts — NAP-CVM transport wiring for the demo shell.
 *
 * Builds the concrete ContextVM transport the playground hands to
 * `createCvmService`. By default it talks to the real Relatr ContextVM server
 * over Nostr (CEP-4 gift-wrapped kind-25910 via `@kehto/services/cvm-nostr-
 * transport`), using a fresh ephemeral client key per session — the user's
 * identity is never exposed to CVM servers.
 *
 * For deterministic end-to-end tests, loading the playground with
 * `?cvmFixture=1` swaps in an offline fixture transport that returns canned
 * Relatr-shaped responses (no network).
 */

import { createNostrCvmTransport } from '@kehto/services/cvm-nostr-transport';
import type { CvmTransport, CvmServer, McpMessage } from '@kehto/services';

/** Relatr ContextVM server (social-graph trust scores). */
export const RELATR_PUBKEY = '750682303c9f0ddad75941b49edc9d46e3ed306b9ee3335338a21a3e404c5fa3';
export const RELATR_RELAYS = [
  'wss://relay.contextvm.org',
  'wss://relay2.contextvm.org',
  'wss://relay.primal.net',
];

function useFixtureTransport(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('cvmFixture');
}

const RELATR_FIXTURE: CvmServer = {
  pubkey: RELATR_PUBKEY,
  relays: RELATR_RELAYS,
  name: 'Relatr',
  description: 'Relatr is a social graph analysis and trust score service for Nostr.',
  capabilities: ['calculate_trust_score', 'calculate_trust_scores', 'search_profiles'],
  paymentRequired: false,
};

/** Offline fixture transport — canned Relatr responses for e2e determinism. */
function createFixtureCvmTransport(): CvmTransport {
  return {
    async discover() {
      return [RELATR_FIXTURE];
    },
    async request(_server, message: McpMessage) {
      if (message.method === 'tools/call') {
        const args = (message.params as { arguments?: { targetPubkey?: string } } | undefined)?.arguments;
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [],
            structuredContent: {
              trustScore: {
                sourcePubkey: RELATR_PUBKEY,
                targetPubkey: args?.targetPubkey ?? '',
                score: 0.87,
                components: { distanceWeight: 0.5, socialDistance: 2, normalizedDistance: 0.74 },
                computedAt: 0,
              },
              computationTimeMs: 12,
            },
          },
        } satisfies McpMessage;
      }
      if (message.method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: { tools: RELATR_FIXTURE.capabilities!.map((name) => ({ name })) },
        } satisfies McpMessage;
      }
      return { jsonrpc: '2.0', id: message.id, result: {} } satisfies McpMessage;
    },
    async close() {},
    onEvent() {
      return { close() {} };
    },
  };
}

/**
 * Create the CVM transport for the demo shell.
 *
 * @returns A {@link CvmTransport} — the offline fixture under `?cvmFixture=1`,
 *   otherwise a live Nostr transport pointed at Relatr's relay set.
 */
export function createPlaygroundCvmTransport(): CvmTransport {
  if (useFixtureTransport()) return createFixtureCvmTransport();
  return createNostrCvmTransport({ defaultRelays: RELATR_RELAYS });
}
