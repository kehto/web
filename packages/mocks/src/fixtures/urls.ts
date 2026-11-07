/**
 * fixtures/urls.ts — Placeholder origins for mock-generated URLs.
 *
 * Every URL a mock hands out lives under a reserved `example.org` host so no
 * fixture ever points at a real deployment. Domain mocks derive their URLs
 * from these origins instead of carrying inline URL literals.
 */

/** Scheme shared by every fixture origin. */
const MOCK_URL_SCHEME = 'https';

/**
 * Build a placeholder origin for a reserved fixture host.
 *
 * @param host - Host under a reserved example domain, e.g. `files.example.org`.
 * @returns The origin, without a trailing slash.
 * @example
 * ```ts
 * mockOrigin('files.example.org') === 'https://files.example.org';
 * ```
 */
export function mockOrigin(host: string): string {
  return `${MOCK_URL_SCHEME}://${host}`;
}

/**
 * Fixed placeholder origins used by the domain mocks.
 *
 * @example
 * ```ts
 * const artwork = `${MOCK_URLS.media}/cc/track.jpg`;
 * ```
 */
export const MOCK_URLS = Object.freeze({
  /** Media files, artwork, and theme backgrounds. */
  media: mockOrigin('media.example.org'),
  /** Theme web fonts. */
  fonts: mockOrigin('fonts.example.org'),
  /** Blossom upload rail. */
  blossom: mockOrigin('blossom.example.org'),
  /** NIP-96 upload rail. */
  files: mockOrigin('files.example.org'),
});
