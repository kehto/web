/**
 * domains/link.ts — Mock NAP-LINK service.
 *
 * Spec: naps/NAP-LINK.md @ napplet/naps PR #53 head 50c2d45c (draft)
 * Routes: link.open
 * Spec gaps / decisions:
 *   - Only `http:` and `https:` open by default; every other scheme (including
 *     `javascript:`, `data:`, `blob:`, `file:`) is denied with
 *     `unsupported-scheme`. `allowedSchemes` can add `nostr:`/`mailto:` by policy.
 *   - A missing, non-string, relative, or unparsable `url` is denied with
 *     `invalid-url`; hosts listed in `blockedHosts` are denied with
 *     `blocked-by-policy`. The mock never prompts, so `user-denied` is only
 *     produced when `denyAll` is set.
 *   - `options.label` is recorded verbatim as untrusted text and never affects
 *     the decision.
 */
import type { LinkOpenErrorCode, LinkOpenOptions, LinkOpenStatus } from '@napplet/nap/link/types';
import { defineMockService } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/** Spec document read when this mock was written. */
export const LINK_SPEC_REF: NapSpecRef = {
  nap: 'NAP-LINK',
  status: 'draft',
  source: 'pr',
  pr: 53,
  sha: '50c2d45c',
  path: 'naps/NAP-LINK.md',
};

/**
 * One `link.open` decision the mock recorded.
 *
 * @example
 * ```ts
 * const entry: MockLinkRecord = { windowId: 'w1', url: 'https://example.org/', status: 'opened', at: 0 };
 * ```
 */
export interface MockLinkRecord {
  /** Requesting window. */
  windowId: string;
  /** URL exactly as the napplet sent it. */
  url: string;
  /** Untrusted napplet-supplied prompt label, when given. */
  label?: string;
  /** Decision reported to the napplet. */
  status: LinkOpenStatus;
  /** Denial reason when `status` is `denied`. */
  error?: LinkOpenErrorCode;
  /** `clock.now()` when the request was handled. */
  at: number;
}

/**
 * In-memory state of the link mock.
 *
 * @example
 * ```ts
 * const opened = service.mock.state().records.filter((r) => r.status === 'opened');
 * ```
 */
export interface MockLinkState {
  /** Every request in arrival order (opened and denied). */
  records: MockLinkRecord[];
}

/**
 * Options for `createMockLinkService`.
 *
 * @example
 * ```ts
 * const options: MockLinkOptions = { allowedSchemes: ['https:', 'nostr:'], blockedHosts: ['evil.example'] };
 * ```
 */
export interface MockLinkOptions extends MockServiceOptions {
  /** URL protocols (with trailing colon) that may open. Default `['http:', 'https:']`. */
  allowedSchemes?: readonly string[];
  /** Hostnames denied with `blocked-by-policy`. Default none. */
  blockedHosts?: readonly string[];
  /** Deny every otherwise-valid request with `user-denied`, simulating a user refusal. */
  denyAll?: boolean;
}

/** The link mock service. */
export type MockLinkService = MockService<MockLinkState>;

const DEFAULT_SCHEMES: readonly string[] = Object.freeze(['http:', 'https:']);

function decide(raw: unknown, options: MockLinkOptions): { status: LinkOpenStatus; error?: LinkOpenErrorCode } {
  if (typeof raw !== 'string' || raw.length === 0) return { status: 'denied', error: 'invalid-url' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { status: 'denied', error: 'invalid-url' };
  }
  if (!(options.allowedSchemes ?? DEFAULT_SCHEMES).includes(url.protocol)) return { status: 'denied', error: 'unsupported-scheme' };
  if (options.blockedHosts?.includes(url.hostname)) return { status: 'denied', error: 'blocked-by-policy' };
  if (options.denyAll) return { status: 'denied', error: 'user-denied' };
  return { status: 'opened' };
}

/**
 * Create the NAP-LINK mock. Validates the URL like a conformant shell and
 * records every decision in `mock.state().records`.
 *
 * @param options - Scheme allowlist, blocked hosts, and shared mock options.
 * @returns The link mock service.
 * @example
 * ```ts
 * const link = createMockLinkService();
 * link.handleMessage('w1', { type: 'link.open', id: 'l1', url: 'https://example.org/' }, send);
 * // → { type: 'link.open.result', id: 'l1', status: 'opened' }
 * ```
 */
export function createMockLinkService(options: MockLinkOptions = {}): MockLinkService {
  return defineMockService<MockLinkState>({
    domain: 'link',
    version: '1.0.0',
    description: 'Mock NAP-LINK shell-mediated link opener',
    kind: 'service',
    initialState: () => ({ records: [] }),
    routes: {
      'link.open': ({ message, windowId, state, clock, reply }) => {
        const decision = decide(message.url, options);
        const label = (message.options as LinkOpenOptions | undefined)?.label;
        state.records.push({
          windowId,
          url: typeof message.url === 'string' ? message.url : '',
          ...(typeof label === 'string' ? { label } : {}),
          ...decision,
          at: clock.now(),
        });
        reply({ ...decision });
      },
    },
  }, options);
}

/** Registry row for the link mock. */
export const LINK_MOCK_ENTRY: MockDomainEntry = {
  domain: 'link',
  kind: 'service',
  spec: LINK_SPEC_REF,
  create: (options) => createMockLinkService(options),
};
