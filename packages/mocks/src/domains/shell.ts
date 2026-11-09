/**
 * domains/shell.ts — NAP-SHELL registry entry (runtime-owned, no mock service).
 *
 * Spec: naps/NAP-SHELL.md @ napplet/naps master 43cb3a4e8555 (merged)
 * Routes: none mocked. `shell.ready` → `shell.init` is answered by the shell
 *         package (`packages/shell/src/shell-ready.ts`, `shell-init.ts`).
 * Spec gaps / decisions:
 * - `shell.init.capabilities.domains` must list every domain the napplet can
 *   reach, so `mockShellEnvironmentDomains` derives that list from the mock
 *   registry: every `service`/`extension`/`adapter` row plus the runtime-owned
 *   `shell`, `storage`, and `inc` domains. `posture` rows carry no wire domain
 *   and are excluded.
 * - The NAP says nothing about ordering; the runtime-owned domains come first
 *   (matching the shell package's native list), then registry order, deduped.
 */
import type { MockDomainEntry, NapSpecRef } from '../core/types.js';

/**
 * NAP-SHELL document checked when this entry was written.
 *
 * @example
 * ```ts
 * SHELL_SPEC_REF.source === 'master';
 * ```
 */
export const SHELL_SPEC_REF: NapSpecRef = {
  nap: 'NAP-SHELL',
  status: 'merged',
  source: 'master',
  sha: '43cb3a4e8555',
  path: 'naps/NAP-SHELL.md',
};

/**
 * Domains every mock shell environment lists regardless of the registry:
 * `shell` (this NAP), `storage` (runtime adapter), `inc` (runtime-owned).
 *
 * @example
 * ```ts
 * MOCK_SHELL_RUNTIME_DOMAINS.includes('inc');
 * ```
 */
export const MOCK_SHELL_RUNTIME_DOMAINS: readonly string[] = Object.freeze(['shell', 'storage', 'inc']);

/** Kinds whose `domain` is a wire domain a shell can expose. */
const WIRE_KINDS: ReadonlySet<MockDomainEntry['kind']> = new Set(['service', 'extension', 'adapter']);

/**
 * Wire domains a shell should list in `shell.init.capabilities.domains` so
 * that every mock in `entries` is reachable from the napplet.
 *
 * @param entries - Mock registry rows (any order, any kinds).
 * @returns Deduplicated domain list: `shell`, `storage`, `inc`, then each
 * `service`/`extension`/`adapter` domain in `entries` order.
 * @example
 * ```ts
 * const domains = mockShellEnvironmentDomains(DOMAIN_ENTRIES);
 * const environment = { capabilities: { domains }, services: [] };
 * ```
 */
export function mockShellEnvironmentDomains(entries: readonly MockDomainEntry[]): string[] {
  const domains = new Set<string>(MOCK_SHELL_RUNTIME_DOMAINS);
  for (const entry of entries) if (WIRE_KINDS.has(entry.kind)) domains.add(entry.domain);
  return [...domains];
}

/**
 * Registry row for NAP-SHELL: runtime-owned, no factory.
 *
 * @example
 * ```ts
 * SHELL_MOCK_ENTRY.create === undefined;
 * ```
 */
export const SHELL_MOCK_ENTRY: MockDomainEntry = {
  domain: 'shell',
  kind: 'runtime-owned',
  spec: SHELL_SPEC_REF,
  note: 'The shell package owns shell.ready/shell.init (packages/shell/src/shell-ready.ts). '
    + 'A mock environment only needs capabilities.domains to list every mocked domain; '
    + 'use mockShellEnvironmentDomains(entries) to build that list.',
};
