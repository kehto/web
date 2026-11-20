import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

type Envelope = Readonly<Record<string, unknown>> | null;

/** Handle of the first selection; NAP-LLM handles are opaque, so the target must issue `h1` first (the NAP's example). */
const HANDLE = 'h1';
const MODEL_FIELDS = ['handle', 'name', 'model', 'route', 'images', 'json', 'tools', 'toolChoiceModes'] as const;
const WEATHER_TOOL = { name: 'get_weather', description: 'Look up current weather', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } };
const userMessage = (text: string) => ({ role: 'user', content: [{ type: 'text', text }] });

function modelProblem(model: unknown): SemanticVerdict {
  const record = model as Record<string, unknown> | undefined;
  if (!record || typeof record !== 'object') return `model was ${JSON.stringify(model)}`;
  const missing = MODEL_FIELDS.filter((field) => record[field] === undefined);
  if (missing.length) return `model lacks ${missing.join(', ')}`;
  const modes = record.toolChoiceModes as unknown[];
  if (!Array.isArray(modes) || new Set(modes).size !== modes.length) return `toolChoiceModes was ${JSON.stringify(modes)}`;
  if (record.tools === true && !(modes.includes('auto') && modes.includes('none'))) return '"tools: true MUST support auto and none" but toolChoiceModes lacks one';
  if (record.tools === false && modes.length) return 'toolChoiceModes must be empty when tools is false';
  return null;
}

/** An error result: `error.code` is the expected code and no success payload rides along. */
const failsWith = (code: string, successField: string) => (reply: Envelope): SemanticVerdict => {
  const error = reply?.error as { code?: unknown; message?: unknown } | undefined;
  if (error?.code !== code) return `error was ${JSON.stringify(reply?.error)}, expected code ${code}`;
  if (typeof error.message !== 'string') return 'error.message is required text';
  return reply?.[successField] === undefined ? null : `"Error results contain error and no success payload", but ${successField} was present`;
};

const generate = (id: string, request: Record<string, unknown>, rest: Partial<OperationCase> = {}): OperationCase => ({ id, type: 'llm.generate', payload: { request: { handle: HANDLE, ...request } }, ...rest });

const notCancelled = (rule: string): OperationCase['semantics'] => ({
  rule, verify: (reply) => (reply?.cancelled === false && reply.error === undefined ? null : `cancel returned ${JSON.stringify({ cancelled: reply?.cancelled, error: reply?.error })}`),
});

/**
 * NAP-LLM at napplet/naps#134 head: select, describe, generate (buffered or
 * streamed, JSON, tool use), cancel, and the invalid-request / selection-expired
 * paths a controllable provider fixture can reach (the NAP's LLM-C01, C02, C09,
 * C15 and C20 cases).
 */
export const LLM_FIXTURE: DomainFixture = {
  domain: 'llm',
  cases: [
    {
      id: 'llm/select', type: 'llm.select', payload: { requirements: { json: true } },
      semantics: {
        rule: 'llm.select.result carries a complete Model; a required json capability is not downgraded; toolChoiceModes is exact and tools:true lists auto and none',
        verify: (reply) => modelProblem(reply?.model) ?? ((reply?.model as { json?: unknown }).json === true ? null : 'select with json:true returned a model without json'),
      },
    },
    {
      id: 'llm/select-unknown-field', type: 'llm.select', payload: { requirements: { json: true, colour: 'blue' } }, allowError: true,
      semantics: { rule: '"Unknown fields in these input records ... MUST produce invalid-request"', verify: failsWith('invalid-request', 'model') },
    },
    {
      id: 'llm/describe', type: 'llm.describe', payload: { handle: HANDLE },
      semantics: { rule: 'describe revalidates a live handle and returns its Model', verify: (reply) => modelProblem(reply?.model) ?? ((reply?.model as { handle?: unknown }).handle === HANDLE ? null : `model.handle was ${JSON.stringify((reply?.model as { handle?: unknown }).handle)}`) },
    },
    {
      id: 'llm/describe-unknown-handle', type: 'llm.describe', payload: { handle: 'conformance-unknown-handle' }, allowError: true,
      semantics: { rule: 'An "Unknown, revoked, changed or foreign handle" fails with selection-expired', verify: failsWith('selection-expired', 'model') },
    },
    generate('llm/generate', { messages: [userMessage('Return a JSON object with a greeting.')], format: 'json', maxTokens: 128 }, {
      semantics: {
        rule: 'A format:"json" stop result\'s concatenated text "MUST parse as a JSON object"',
        verify(reply) {
          const result = reply?.result as { content?: { type?: unknown; text?: unknown }[]; finish?: unknown } | undefined;
          if (result?.finish !== 'stop') return `finish was ${JSON.stringify(result?.finish)}`;
          const text = (result.content ?? []).filter((part) => part.type === 'text').map((part) => String(part.text)).join('');
          try {
            const parsed: unknown = JSON.parse(text);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? null : `text ${text} is not a JSON object`;
          } catch { return `text ${JSON.stringify(text)} does not parse as JSON`; }
        },
      },
    }),
    generate('llm/generate-explicit-null', { messages: [userMessage('hi')], temperature: null }, {
      allowError: true,
      semantics: { rule: '"explicit null ... MUST produce invalid-request" (LLM-C02)', verify: failsWith('invalid-request', 'result') },
    }),
    generate('llm/generate-tool-call', { messages: [userMessage('TOOL: What is the weather in Berlin?')], tools: [WEATHER_TOOL], toolChoice: 'auto' }, {
      semantics: {
        rule: '"A successfully completed turn containing any toolCall MUST have finish: toolUse, regardless of the provider\'s normal stop label" (LLM-C15)',
        verify(reply) {
          const result = reply?.result as { content?: { type?: unknown; name?: unknown; arguments?: unknown }[]; finish?: unknown } | undefined;
          const call = result?.content?.find((part) => part.type === 'toolCall');
          if (!call) return `no toolCall part in ${JSON.stringify(result?.content)}`;
          if (call.name !== 'get_weather' || !call.arguments || typeof call.arguments !== 'object') return `toolCall was ${JSON.stringify(call)}`;
          return result?.finish === 'toolUse' ? null : `finish was ${JSON.stringify(result?.finish)}, expected "toolUse"`;
        },
      },
    }),
    generate('llm/generate-duplicate-tools', { messages: [userMessage('hi')], tools: [WEATHER_TOOL, WEATHER_TOOL] }, {
      allowError: true,
      semantics: { rule: '"Tool names MUST be unique within tools" ... violations "MUST produce invalid-request" (LLM-C20)', verify: failsWith('invalid-request', 'result') },
    }),
    { id: 'llm/cancel-finished', type: 'llm.cancel', payload: { requestId: 'llm/generate' }, semantics: notCancelled('An "already terminal ... requestId returns cancelled: false"') },
    { id: 'llm/cancel-unknown', type: 'llm.cancel', payload: { requestId: 'llm/never-sent' }, semantics: notCancelled('An "unknown ... requestId returns cancelled: false, without revealing its existence"') },
  ],
  pushes: [
    {
      // The delta is produced by the llm/generate case itself, so the push has no host trigger.
      id: 'llm/delta', type: 'llm.delta',
      semantics: {
        rule: 'Streamed deltas carry the generation id as requestId with a "contiguous sequence starting at zero", each block opening with start (LLM-C09)',
        verify(push) {
          if (!push) return 'no llm.delta';
          if ('id' in push) return '"llm.delta ... no separate id", but it carried id';
          const expected = { requestId: 'llm/generate', sequence: 0, event: 'start', block: 'text', blockIndex: 0 };
          const wrong = Object.entries(expected).filter(([key, value]) => push[key] !== value);
          return wrong.length ? `first delta was ${JSON.stringify(push)}` : null;
        },
      },
    },
  ],
};
