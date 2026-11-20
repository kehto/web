import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

const SUCCESS_FIELDS = new Set(['type', 'id', 'ok', 'count', 'approximate', 'hll', 'relays']);

/** NAP-COUNT `CountSuccess`: ok true, a non-negative integer count, and no failure fields. */
function countSuccess(reply: Readonly<Record<string, unknown>> | null): SemanticVerdict {
  if (reply?.ok !== true) return `ok was ${JSON.stringify(reply?.ok)}, expected true`;
  if (typeof reply.count !== 'number' || !Number.isInteger(reply.count) || reply.count < 0) return `count was ${JSON.stringify(reply.count)}, expected a non-negative integer`;
  const extra = Object.keys(reply).filter((key) => !SUCCESS_FIELDS.has(key));
  return extra.length ? `a successful result carried ${extra.join(', ')}` : null;
}

const query = (id: string, payload: Record<string, unknown>, rule: string): OperationCase => ({
  id, type: 'count.query', payload, semantics: { rule, verify: countSuccess },
});

/** NAP-COUNT at napplet/naps#69 (9353a0c6): exact and approximation-permitted queries. */
export const COUNT_FIXTURE: DomainFixture = {
  domain: 'count',
  cases: [
    query('count/query', { filters: [{ kinds: [1] }] },
      'A successful count.query.result is a CountSuccess: ok true, a non-negative integer count, and no error or reason'),
    query('count/query-or', { filters: [{ kinds: [7], '#e': ['a'.repeat(64)] }, { kinds: [6], '#e': ['a'.repeat(64)] }], options: { approximate: true, hll: true } },
      'Several filters aggregate into one count; the result is still exactly one CountSuccess'),
  ],
};
