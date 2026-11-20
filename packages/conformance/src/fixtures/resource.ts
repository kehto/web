import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

/** Origin the target's resource resolver serves the fixture paths from (`/bytes`, `/empty`, `/hello.txt`, `/hold`). */
export const RESOURCE_FIXTURE_ORIGIN = 'https://resource.conformance.invalid';
const ORIGIN = RESOURCE_FIXTURE_ORIGIN;
const BYTES = `${ORIGIN}/bytes`;
const MISSING = `${ORIGIN}/missing`;
const HOLD = `${ORIGIN}/hold`;

type Reply = Readonly<Record<string, unknown>> | null;

/** RFC 4648 section 4: standard alphabet, required padding, no whitespace. */
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function errorCode(reply: Reply, code: string): SemanticVerdict {
  return reply?.error === code ? null : `error was ${JSON.stringify(reply?.error)}, expected ${JSON.stringify(code)}`;
}

function bytesMany(reply: Reply): SemanticVerdict {
  const items = reply?.items;
  if (!Array.isArray(items) || items.length !== 2) return `items was ${JSON.stringify(items)}, expected two items in request order`;
  const [first, second] = items as Record<string, unknown>[];
  if (first?.url !== BYTES || second?.url !== MISSING) return `items were out of request order: ${JSON.stringify(items.map((item) => (item as Record<string, unknown>)?.url))}`;
  if (first.ok !== true || first.blob !== 'AAEC/w==' || typeof first.mime !== 'string') return `the successful sibling was ${JSON.stringify(first)}`;
  if (second.ok !== false || typeof second.error !== 'string' || 'blob' in second) return `the failed item was ${JSON.stringify(second)}`;
  return null;
}

/** An error-envelope case: the NAP-RESOURCE reply type is `<type>.error`, whose `error` field is the payload. */
const failure = (id: string, type: string, payload: Record<string, unknown>, code: string, rule: string): OperationCase => ({
  id, type, payload, reply: `${type}.error`, allowError: true, semantics: { rule, verify: (reply) => errorCode(reply, code) },
});

/** NAP-RESOURCE at napplet/naps#80 (ae5b9c64): info, bytes, bytesMany, error envelopes and cancellation. */
export const RESOURCE_FIXTURE: DomainFixture = {
  domain: 'resource',
  cases: [
    {
      id: 'resource/info', type: 'resource.info',
      semantics: {
        rule: 'resource.info.result carries ResourceInfo: a schemes list of { scheme, enabled }',
        verify: (reply) => {
          const schemes = (reply?.info as { schemes?: unknown } | undefined)?.schemes;
          const valid = Array.isArray(schemes) && schemes.every((entry) => typeof entry?.scheme === 'string' && typeof entry?.enabled === 'boolean');
          return valid ? null : `info was ${JSON.stringify(reply?.info)}`;
        },
      },
    },
    {
      id: 'resource/bytes', type: 'resource.bytes', payload: { url: BYTES },
      semantics: {
        rule: 'Bytes 00 01 02 ff travel as canonical padded base64 "AAEC/w==", with a mime',
        verify: (reply) => (reply?.blob === 'AAEC/w==' && typeof reply.mime === 'string' ? null : `blob ${JSON.stringify(reply?.blob)}, mime ${JSON.stringify(reply?.mime)}`),
      },
    },
    {
      id: 'resource/bytes-empty', type: 'resource.bytes', payload: { url: `${ORIGIN}/empty` },
      semantics: { rule: 'Empty bytes encode as ""', verify: (reply) => (reply?.blob === '' ? null : `blob was ${JSON.stringify(reply?.blob)}`) },
    },
    {
      id: 'resource/bytes-text', type: 'resource.bytes', payload: { url: `${ORIGIN}/hello.txt` },
      semantics: { rule: 'Every wire blob is canonical padded base64 text, never host bytes', verify: (reply) => (typeof reply?.blob === 'string' && CANONICAL_BASE64.test(reply.blob) ? null : `blob was ${JSON.stringify(reply?.blob)}`) },
    },
    {
      id: 'resource/bytesMany', type: 'resource.bytesMany', payload: { urls: [BYTES, MISSING] },
      semantics: { rule: 'bytesMany items preserve input order and length; a failed URL keeps error without blob and does not discard its successful sibling', verify: bytesMany },
    },
    failure('resource/bytes-unsupported-scheme', 'resource.bytes', { url: 'gopher://resource.conformance.invalid/x' }, 'unsupported-scheme', 'Unknown schemes MUST return unsupported-scheme, even without a resource.info preflight'),
    failure('resource/bytes-missing-url', 'resource.bytes', {}, 'invalid-request', 'A malformed payload or missing field is invalid-request'),
    failure('resource/bytesMany-empty', 'resource.bytesMany', { urls: [] }, 'invalid-request', 'An empty urls list is a top-level resource.bytesMany.error with invalid-request'),
  ],
  pushes: [
    {
      // `/hold` is answered only by the `resource.release` control, so nothing may come back inside each quiet window.
      id: 'resource/cancel-drops-late-result', type: 'resource.bytes.result',
      subscribe: { id: 'resource/held-a', type: 'resource.bytes', payload: { url: HOLD }, reply: null },
      trigger: { control: 'resource.release' },
      match: { id: 'resource/held-a' },
      then: [{ id: 'resource/held-b', type: 'resource.bytes', payload: { url: HOLD }, reply: null }],
      unsubscribe: { id: 'resource/cancel', type: 'resource.cancel', payload: { id: 'resource/held-b' }, reply: null },
      semantics: {
        rule: 'A released request gets its terminal result; after resource.cancel for another in-flight id, its late terminal envelope is dropped',
        verify: (push) => (typeof push?.blob === 'string' && CANONICAL_BASE64.test(push.blob) ? null : `the released result was ${JSON.stringify(push)}`),
      },
    },
  ],
};
