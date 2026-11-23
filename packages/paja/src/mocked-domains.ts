/**
 * `@kehto/mocks` extension domains Paja deliberately does not expose, with the
 * reason. A domain lands here when its NAP is off the `napplet/naps` track
 * (deferred, retracted), so a napplet must not be led to build against it.
 */
export const PAJA_UNMOCKED_DOMAINS: Readonly<Record<string, string>> = Object.freeze({
  class: 'NAP-CLASS (napplet/naps#16) is labeled DEFERRED and is off the track.',
});

/**
 * NAP domains Paja has no real backend for and serves from `@kehto/mocks`.
 *
 * Every entry is an `extension` mock in `MOCK_NAP_REGISTRY` that Paja does not
 * otherwise advertise and has not excluded in {@link PAJA_UNMOCKED_DOMAINS};
 * `mocked-domains.test.ts` keeps the list in sync. These interfaces answer with
 * deterministic fixture data, and the Interfaces panel marks them with
 * {@link PAJA_MOCKED_MARK}.
 */
export const PAJA_MOCKED_DOMAINS = [
  'blossom',
  'capture',
  'catalog',
  'display',
  'git',
  'hashtree',
  'location',
  'motion',
  'navigation',
  'nzb',
  'pow',
  'soulseek',
  'system',
  'torrent',
  'value',
  'worker',
] as const;

/** A NAP domain Paja serves from `@kehto/mocks`. */
export type PajaMockedDomain = typeof PAJA_MOCKED_DOMAINS[number];

/** Symbol prefixed to mocked interfaces in Paja's UI; explained by the panel legend. */
export const PAJA_MOCKED_MARK = '◌';

/**
 * Whether Paja serves a domain from `@kehto/mocks`.
 *
 * @param domain - Bare NAP domain.
 * @returns `true` for a mocked domain.
 * @example
 * ```ts
 * isPajaMockedDomain('torrent'); // true
 * isPajaMockedDomain('relay');   // false
 * ```
 */
export function isPajaMockedDomain(domain: string): domain is PajaMockedDomain {
  return (PAJA_MOCKED_DOMAINS as readonly string[]).includes(domain);
}
