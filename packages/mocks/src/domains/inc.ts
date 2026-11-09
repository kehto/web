/**
 * domains/inc.ts — NAP-INC registry entry (runtime-owned, no mock service).
 *
 * Spec: naps/NAP-INC.md @ napplet/naps master 43cb3a4e8555 (merged)
 * Routes: none mocked. `inc.*` topics and channels are routed by the runtime
 *         (`packages/runtime/src/inc-handler.ts`) between live napplet
 *         endpoints; the runtime attests `sender`/`peer` from authenticated
 *         sessions.
 * Spec gaps / decisions:
 * - A mock must not fabricate `inc.event`, `inc.channel.opened`, or
 *   `inc.channel.event` deliveries: the NAP makes runtime sender attestation
 *   the trust boundary, and a service-level mock cannot bind an endpoint
 *   identifier to a verified manifest. Shells get INC for free from the
 *   runtime, so this module only ships topic fixtures for tests.
 * - Topic strings are opaque per the NAP (exact-match routing, no prefix or
 *   wildcard semantics); the fixtures follow the advisory `napplet:` and
 *   `shell:` conventions and carry no query parameters.
 */
import type { MockDomainEntry, NapSpecRef } from '../core/types.js';

/**
 * NAP-INC document checked when this entry was written.
 *
 * @example
 * ```ts
 * INC_SPEC_REF.nap === 'NAP-INC';
 * ```
 */
export const INC_SPEC_REF: NapSpecRef = {
  nap: 'NAP-INC',
  status: 'merged',
  source: 'master',
  sha: '43cb3a4e8555',
  path: 'naps/NAP-INC.md',
};

/**
 * A few opaque INC topic strings for tests. Values are stable topics (no
 * convention-URI query), ready for `inc.subscribe` and `inc.emit`.
 *
 * @example
 * ```ts
 * runtime.handleMessage('w1', { type: 'inc.subscribe', id: 'a1', topic: MOCK_INC_TOPICS.profileOpen });
 * ```
 */
export const MOCK_INC_TOPICS = Object.freeze({
  /** Archetype topic: open a profile. */
  profileOpen: 'napplet:profile/open',
  /** Archetype topic: open a direct-message thread. */
  dmOpen: 'napplet:dm/open',
  /** Archetype topic: start media playback. */
  mediaPlay: 'napplet:media/play',
  /** Shell-intercepted command topic. */
  shellStateGet: 'shell:state-get',
} as const);

/**
 * Registry row for NAP-INC: runtime-owned, no factory.
 *
 * @example
 * ```ts
 * INC_MOCK_ENTRY.create === undefined;
 * ```
 */
export const INC_MOCK_ENTRY: MockDomainEntry = {
  domain: 'inc',
  kind: 'runtime-owned',
  spec: INC_SPEC_REF,
  note: 'The runtime routes inc.* topics and channels itself (packages/runtime/src/inc-handler.ts) '
    + 'and attests sender/peer from authenticated endpoints. Mocks cannot and must not fabricate '
    + 'INC deliveries; shells get INC for free from the runtime. MOCK_INC_TOPICS supplies topic strings for tests.',
};
