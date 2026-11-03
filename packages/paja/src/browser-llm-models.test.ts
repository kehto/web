import { describe, expect, it } from 'vitest';
import { fetchPajaLlmModels, llmModelsUrl, PajaLlmModelsError } from './browser-llm-models.js';

const BASE = 'http://127.0.0.1:8008/v1';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('model listing url', () => {
  it('joins the API root and listing path without doubling or dropping separators', () => {
    expect(llmModelsUrl(BASE, '/models')).toBe('http://127.0.0.1:8008/v1/models');
    expect(llmModelsUrl(`${BASE}/`, 'models')).toBe('http://127.0.0.1:8008/v1/models');
    expect(llmModelsUrl('https://api.example.test', '/v1/models')).toBe('https://api.example.test/v1/models');
  });
});

describe('fetchPajaLlmModels', () => {
  it('reads the OpenAI shape, de-duplicates and sorts', async () => {
    const urls: string[] = [];
    const models = await fetchPajaLlmModels({
      baseUrl: BASE,
      modelsPath: '/models',
      fetch: (async (url: string) => {
        urls.push(String(url));
        return jsonResponse({ object: 'list', data: [{ id: 'zeta' }, { id: 'alpha' }, { id: 'zeta' }, { name: 'no id' }] });
      }) as unknown as typeof fetch,
    });
    expect(urls).toEqual(['http://127.0.0.1:8008/v1/models']);
    expect(models).toEqual(['alpha', 'zeta']);
  });

  it('accepts the plain array and { models } forms hosts echo back', async () => {
    const plain = await fetchPajaLlmModels({
      baseUrl: BASE, modelsPath: '/models',
      fetch: (async () => jsonResponse(['b', 'a'])) as unknown as typeof fetch,
    });
    expect(plain).toEqual(['a', 'b']);
    const wrapped = await fetchPajaLlmModels({
      baseUrl: BASE, modelsPath: '/models',
      fetch: (async () => jsonResponse({ models: [{ id: 'm' }] })) as unknown as typeof fetch,
    });
    expect(wrapped).toEqual(['m']);
  });

  it('sends the credential on that one request only, and only when given', async () => {
    const seen: Array<Record<string, string>> = [];
    const capture = (async (_url: string, init?: RequestInit) => {
      seen.push((init?.headers ?? {}) as Record<string, string>);
      return jsonResponse({ data: [{ id: 'm' }] });
    }) as unknown as typeof fetch;
    await fetchPajaLlmModels({ baseUrl: BASE, modelsPath: '/models', fetch: capture });
    await fetchPajaLlmModels({ baseUrl: BASE, modelsPath: '/models', credential: 'sk-test-secret', fetch: capture });
    expect(seen[0]).not.toHaveProperty('authorization');
    expect(seen[1]).toMatchObject({ authorization: 'Bearer sk-test-secret' });
  });

  it('reports http failures without echoing the credential', async () => {
    let caught: unknown;
    try {
      await fetchPajaLlmModels({
        baseUrl: BASE, modelsPath: '/models', credential: 'sk-test-secret',
        fetch: (async () => jsonResponse({ error: 'nope' }, 401)) as unknown as typeof fetch,
      });
    } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PajaLlmModelsError);
    expect((caught as PajaLlmModelsError).failure).toBe('http');
    expect((caught as Error).message).toContain('401');
    expect((caught as Error).message).not.toContain('sk-test-secret');
  });

  it('names CORS as a cause when the browser reports an opaque fetch failure', async () => {
    let caught: unknown;
    try {
      await fetchPajaLlmModels({
        baseUrl: BASE, modelsPath: '/models',
        fetch: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch,
      });
    } catch (error) { caught = error; }
    expect((caught as PajaLlmModelsError).failure).toBe('network');
    expect((caught as Error).message).toContain('CORS');
  });

  it('rejects unusable bodies as shape failures', async () => {
    for (const body of [{}, { data: [] }, { data: [{ name: 'no id' }] }, 'text']) {
      let caught: unknown;
      try {
        await fetchPajaLlmModels({ baseUrl: BASE, modelsPath: '/models', fetch: (async () => jsonResponse(body)) as unknown as typeof fetch });
      } catch (error) { caught = error; }
      expect((caught as PajaLlmModelsError).failure).toBe('shape');
    }
    let notJson: unknown;
    try {
      await fetchPajaLlmModels({
        baseUrl: BASE, modelsPath: '/models',
        fetch: (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch,
      });
    } catch (error) { notJson = error; }
    expect((notJson as PajaLlmModelsError).failure).toBe('shape');
  });

  it('times out and honours caller cancellation as distinct failures', async () => {
    const never = (async (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as unknown as typeof fetch;
    let slow: unknown;
    try { await fetchPajaLlmModels({ baseUrl: BASE, modelsPath: '/models', fetch: never, timeoutMs: 20 }); }
    catch (error) { slow = error; }
    expect((slow as PajaLlmModelsError).failure).toBe('timeout');

    const controller = new AbortController();
    const pending = fetchPajaLlmModels({ baseUrl: BASE, modelsPath: '/models', fetch: never, signal: controller.signal });
    controller.abort();
    let cancelled: unknown;
    try { await pending; } catch (error) { cancelled = error; }
    expect((cancelled as PajaLlmModelsError).failure).toBe('aborted');
  });
});
