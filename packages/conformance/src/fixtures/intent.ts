import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

type Reply = Readonly<Record<string, unknown>> | null;
interface Contract { convention?: unknown; params?: unknown }
interface Candidate { id?: unknown; actions?: unknown; conventions?: unknown; contracts?: unknown }

const unique = (values: readonly unknown[]): unknown[] => [...new Set(values)];
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

/**
 * NAP-INTENT catalog contract: a candidate has an id, only contracts for the
 * queried role, and actions/conventions derived from those contracts.
 */
function candidateProblem(candidate: Candidate, archetype: string): string | null {
  if (typeof candidate.id !== 'string' || !candidate.id) return `candidate id was ${JSON.stringify(candidate.id)}`;
  if (!Array.isArray(candidate.contracts) || !candidate.contracts.length) return `candidate ${candidate.id} has no contracts`;
  const contracts = candidate.contracts as Contract[];
  const foreign = contracts.find((contract) => typeof contract.convention !== 'string' || !contract.convention.startsWith(`napplet:${archetype}/`) || !Array.isArray(contract.params));
  if (foreign) return `candidate ${candidate.id} carries contract ${JSON.stringify(foreign)} outside role ${archetype}`;
  const conventions = unique(contracts.map((contract) => contract.convention));
  const actions = unique(conventions.map((convention) => String(convention).slice(`napplet:${archetype}/`.length)));
  if (!same(candidate.conventions, conventions)) return `candidate ${candidate.id} conventions ${JSON.stringify(candidate.conventions)} are not derived from its contracts`;
  if (!same(candidate.actions, actions)) return `candidate ${candidate.id} actions ${JSON.stringify(candidate.actions)} are not derived from its contracts`;
  return null;
}

function availabilityProblem(value: unknown, archetype: string): string | null {
  const availability = value as { archetype?: unknown; available?: unknown; candidates?: unknown; hasDefault?: unknown } | undefined;
  if (availability?.archetype !== archetype) return `availability.archetype was ${JSON.stringify(availability?.archetype)}`;
  if (!Array.isArray(availability.candidates) || typeof availability.hasDefault !== 'boolean') return `availability was ${JSON.stringify(availability)}`;
  if (availability.available !== availability.candidates.length > 0) return `available ${JSON.stringify(availability.available)} disagrees with ${availability.candidates.length} candidates`;
  return (availability.candidates as Candidate[]).map((candidate) => candidateProblem(candidate, archetype)).find((problem) => problem !== null) ?? null;
}

/** The catalog this fixture expects: a `note/open` handler advertising the `id` parameter. */
function noteAvailability(reply: Reply): SemanticVerdict {
  const problem = availabilityProblem(reply?.availability, 'note');
  if (problem) return problem;
  const candidates = (reply?.availability as { candidates: Candidate[] }).candidates;
  const contract = candidates.flatMap((candidate) => candidate.contracts as Contract[]).find((item) => item.convention === 'napplet:note/open');
  return contract && same(contract.params, ['id']) ? null : `no note/open contract with params ["id"] in ${JSON.stringify(candidates)}`;
}

const request = (archetype: string, action: string, convention: string, payload?: Record<string, unknown>) => ({ request: { archetype, action, convention, ...(payload ? { payload } : {}) } });

const rejected = (id: string, payload: Record<string, unknown>, rule: string): OperationCase => ({
  id, type: 'intent.invoke', payload,
  semantics: {
    rule,
    verify: (reply) => {
      const result = reply?.result as { ok?: unknown; error?: unknown; handler?: unknown } | undefined;
      if (result?.ok !== false) return `result was ${JSON.stringify(result)}, expected ok: false`;
      return typeof result.error === 'string' && result.error ? null : 'a rejected IntentResult lacks its required error';
    },
  },
});

/** NAP-INTENT at napplet/naps master (377bf939): catalog discovery and invocation from one endpoint. */
export const INTENT_FIXTURE: DomainFixture = {
  domain: 'intent',
  cases: [
    {
      id: 'intent/available', type: 'intent.available', payload: { archetype: 'note' },
      semantics: { rule: 'available() lists candidates built from manifest contracts: only contracts for the role, actions and conventions derived from them, i-tag params in order', verify: noteAvailability },
    },
    {
      id: 'intent/available-none', type: 'intent.available', payload: { archetype: 'conformance-none' },
      semantics: { rule: 'An archetype with no installed handler is unavailable with no candidates', verify: (reply) => availabilityProblem(reply?.availability, 'conformance-none') ?? ((reply?.availability as { available?: unknown }).available === false ? null : 'available was not false') },
    },
    {
      id: 'intent/handlers', type: 'intent.handlers',
      semantics: {
        rule: 'handlers() returns one IntentAvailability per known archetype, each candidate limited to that role',
        verify: (reply) => {
          const handlers = reply?.handlers;
          if (!Array.isArray(handlers) || !handlers.some((item) => item?.archetype === 'note')) return `handlers was ${JSON.stringify(handlers)}`;
          return handlers.map((item) => availabilityProblem(item, String(item?.archetype))).find((problem) => problem !== null) ?? null;
        },
      },
    },
    {
      id: 'intent/invoke', type: 'intent.invoke', payload: request('note', 'open', 'napplet:note/open', { id: 'a'.repeat(64) }),
      semantics: {
        rule: 'An accepted invoke result is ok: true with the normalized archetype, action, convention and the resolved handler',
        verify: (reply) => {
          const result = reply?.result as Record<string, unknown> | undefined;
          if (result?.ok !== true) return `result was ${JSON.stringify(result)}`;
          if (result.archetype !== 'note' || result.action !== 'open' || result.convention !== 'napplet:note/open') return `result was ${JSON.stringify(result)}`;
          return typeof result.handler === 'string' && result.handler ? null : `handler was ${JSON.stringify(result.handler)}`;
        },
      },
    },
    rejected('intent/invoke-inconsistent', request('note', 'open', 'napplet:note/edit'), 'The runtime MUST reject a request whose convention is not exactly napplet:<archetype>/<action>'),
    rejected('intent/invoke-no-handler', request('emoji-list', 'open', 'napplet:emoji-list/open'), 'An invocation with no compatible handler is rejected before acceptance'),
    rejected('intent/invoke-unsupported', request('note', 'share', 'napplet:note/share'), 'The runtime MUST reject an unsupported convention before acceptance (exact convention matching)'),
  ],
  pushes: [
    {
      id: 'intent/changed-default', type: 'intent.changed',
      trigger: { control: 'intent.setDefault', payload: { archetype: 'note', handler: 'conformance-viewer' } },
      then: [{ id: 'intent/available-after-default', type: 'intent.available', payload: { archetype: 'note' } }],
      semantics: {
        rule: 'A default-handler change emits intent.changed with the new availability, and available() then reports the default',
        verify: (push, replies) => {
          const problem = availabilityProblem(push?.availability, 'note');
          if (problem) return problem;
          if ((push?.availability as { hasDefault?: unknown }).hasDefault !== true) return 'intent.changed did not report the new default';
          const after = replies['intent/available-after-default']?.availability as { hasDefault?: unknown; candidates?: { isDefault?: unknown }[] } | undefined;
          return after?.hasDefault === true && after.candidates?.some((candidate) => candidate.isDefault === true) ? null : `available() after the change was ${JSON.stringify(after)}`;
        },
      },
    },
  ],
};
