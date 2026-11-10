import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPinnedResource, startPajaServer } from './server.js';

const transport = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: transport.lookup }));
vi.mock('node:http', async (original) => ({ ...await original<object>(), request: transport.request }));
vi.mock('node:https', () => ({ request: transport.request }));

function reply(status = 200, headers: Record<string, string> = {}, body = new Uint8Array([1, 2])) {
  transport.request.mockImplementation((_url, _options, receive) => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    return {
      once: vi.fn(), destroy: vi.fn(),
      end() {
        receive({ statusCode: status, headers, on(name: string, callback: (...args: unknown[]) => void) { listeners.set(name, callback); } });
        queueMicrotask(() => { listeners.get('data')?.(body); listeners.get('end')?.(); });
      },
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  transport.lookup.mockResolvedValue([{ address: '93.184.215.14', family: 4 }]);
  reply();
});
afterEach(() => vi.useRealTimers());

describe('Paja resource socket boundary', () => {
  // IANA special-purpose registries checked 2026-10-17. Paja deliberately also
  // blocks documentation, translation, benchmark, and protocol-assignment ranges.
  it.each([
    '0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254',
    '172.16.0.1', '192.168.0.1', '192.0.0.8', '192.0.2.1', '192.88.99.1',
    '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1',
    '::', '::1', '0:0:0:0:0:0:0:1', '::ffff:127.0.0.1', '0:0:0:0:0:ffff:7f00:1',
    '64:ff9b::7f00:1', '64:ff9b:1::1', '100::1', '2001::1', '2001:db8::1',
    '2002:7f00:1::', '3fff::1', 'fc00::1', 'fe80::1', 'ff02::1',
  ])('rejects blocked DNS destination %s before transport', async (address) => {
    transport.lookup.mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }]);
    await expect(fetchPinnedResource(new URL('https://resource.example/image'))).rejects.toThrow(/blocked/);
    expect(transport.request).not.toHaveBeenCalled();
  });

  it('rejects a private IP literal without DNS even if a resolver would return a public address', async () => {
    await expect(fetchPinnedResource(new URL('http://127.0.0.1/'))).rejects.toThrow(/blocked/);
    expect(transport.lookup).not.toHaveBeenCalled();
    expect(transport.request).not.toHaveBeenCalled();
  });

  it('accepts public IPv6 and pins all-address lookup requests to that one address', async () => {
    transport.lookup.mockResolvedValue([{ address: '2606:4700:4700::1111', family: 6 }]);
    await fetchPinnedResource(new URL('https://resource.example/image'));
    const callback = vi.fn();
    transport.request.mock.calls[0][1].lookup('resource.example', { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [{ address: '2606:4700:4700::1111', family: 6 }]);
  });

  it('does not begin DNS for an already cancelled request', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    await expect(fetchPinnedResource(new URL('https://resource.example/'), controller.signal)).rejects.toThrow('cancelled');
    expect(transport.lookup).not.toHaveBeenCalled();
  });

  it('cancels DNS waiting and ignores its late resolution', async () => {
    let resolveDns!: (answers: { address: string; family: number }[]) => void;
    transport.lookup.mockReturnValue(new Promise((resolve) => { resolveDns = resolve; }));
    const controller = new AbortController();
    const pending = fetchPinnedResource(new URL('https://resource.example/'), controller.signal);
    controller.abort(new Error('revoked'));
    await expect(pending).rejects.toThrow('revoked');
    resolveDns([{ address: '93.184.215.14', family: 4 }]);
    await Promise.resolve();
    expect(transport.request).not.toHaveBeenCalled();
  });

  it('bounds stalled DNS with the same request deadline', async () => {
    vi.useFakeTimers();
    transport.lookup.mockReturnValue(new Promise(() => {}));
    const pending = expect(fetchPinnedResource(new URL('https://resource.example/'))).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(30_000);
    await pending;
    expect(transport.request).not.toHaveBeenCalled();
  });

  it('destroys a pending socket when cancelled', async () => {
    const destroy = vi.fn();
    transport.request.mockReturnValue({ once: vi.fn(), end: vi.fn(), destroy });
    const controller = new AbortController();
    const pending = fetchPinnedResource(new URL('https://resource.example/'), controller.signal);
    await vi.waitFor(() => expect(transport.request).toHaveBeenCalledOnce());
    controller.abort(new Error('closed'));
    await expect(pending).rejects.toThrow('closed');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('rejects oversized bodies instead of returning a truncated success', async () => {
    reply(200, {}, new Uint8Array(10 * 1024 * 1024 + 1));
    await expect(fetchPinnedResource(new URL('https://resource.example/'))).rejects.toThrow('byte limit');
  });

  it('pins the validated address without changing Host or TLS identity', async () => {
    await expect(fetchPinnedResource(new URL('https://resource.example:8443/image'))).resolves.toMatchObject({ status: 200 });
    const [url, options] = transport.request.mock.calls[0];
    expect(url.href).toBe('https://resource.example:8443/image');
    expect(options.headers).toEqual({ accept: '*/*', host: 'resource.example:8443' });
    expect(options.servername).toBe('resource.example');
    expect(options.rejectUnauthorized).not.toBe(false);
    const callback = vi.fn();
    options.lookup('resource.example', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, '93.184.215.14', 4);
    expect(transport.lookup).toHaveBeenCalledTimes(1);
  });

  it('returns a redirect without contacting its target', async () => {
    reply(302, { location: 'http://127.0.0.1/secret' });
    await expect(fetchPinnedResource(new URL('https://resource.example/image'))).resolves.toMatchObject({
      status: 302, location: 'http://127.0.0.1/secret',
    });
    expect(transport.lookup).toHaveBeenCalledTimes(1);
    expect(transport.request).toHaveBeenCalledTimes(1);
  });
});

describe('Paja resource proxy caller authority', () => {
  it('aborts upstream work when the host disconnects', async () => {
    const server = await startPajaServer({ options: { targetUrl: 'http://127.0.0.1:5173', port: 0 } });
    try {
      const root = await fetch(server.url);
      const cookie = root.headers.get('set-cookie')!.split(';')[0];
      await root.text();
      const destroy = vi.fn();
      transport.request.mockReturnValue({ once: vi.fn(), end: vi.fn(), destroy });
      const controller = new AbortController();
      const pending = fetch(`${server.url}__kehto/resource`, {
        method: 'POST', signal: controller.signal,
        headers: { origin: new URL(server.url).origin, cookie, 'content-type': 'application/json' },
        body: '{"url":"https://resource.example/image"}',
      });
      const rejected = expect(pending).rejects.toThrow();
      await vi.waitFor(() => expect(transport.request).toHaveBeenCalledOnce());
      controller.abort();
      await rejected;
      await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());
    } finally { await server.close(); }
  });

  it('rejects unauthorized callers before DNS and returns readable redirect metadata to the host', async () => {
    const server = await startPajaServer({ options: { targetUrl: 'http://127.0.0.1:5173', port: 0 } });
    try {
      const root = await fetch(server.url);
      const setCookie = root.headers.get('set-cookie')!;
      expect(setCookie).toContain('HttpOnly; SameSite=Strict');
      expect(setCookie).toContain('Path=/__kehto/resource');
      expect(setCookie).not.toContain('__Host-');
      const cookie = setCookie.split(';')[0];
      await root.text();
      const origin = new URL(server.url).origin;
      const headers = { origin, cookie, 'content-type': 'application/json' };
      const invalidHeaders: Record<string, string>[] = [
        { origin: 'null' }, { origin: 'https://foreign.example' }, { origin: '' },
        { cookie: '' }, { cookie: 'kehto-resource=wrong' },
        { 'content-type': 'text/plain' },
      ];
      for (const change of invalidHeaders) {
        const response = await fetch(`${server.url}__kehto/resource`, {
          method: 'POST', headers: { ...headers, ...change }, body: '{"url":"https://resource.example/image"}',
        });
        expect(response.status).toBe(403);
        expect(response.headers.has('access-control-allow-origin')).toBe(false);
        await response.text();
      }
      const get = await fetch(`${server.url}__kehto/resource`, { headers });
      expect(get.status).toBe(403);
      await get.text();
      expect(await requestWithHost(new URL(`${server.url}__kehto/resource`), { ...headers, host: 'foreign.example' })).toBe(403);
      expect(transport.lookup).not.toHaveBeenCalled();
      reply(302, { location: '/next' });
      const redirected = await fetch(`${server.url}__kehto/resource`, {
        method: 'POST', headers, body: '{"url":"https://resource.example/image"}', redirect: 'manual',
      });
      expect(redirected.status).toBe(200);
      expect(redirected.headers.get('x-kehto-resource-redirect')).toBe('1');
      expect(redirected.headers.has('location')).toBe(false);
      expect(await redirected.json()).toEqual({ status: 302, location: '/next' });
      expect(transport.request).toHaveBeenCalledTimes(1);
    } finally { await server.close(); }
  });
});

async function requestWithHost(url: URL, headers: Record<string, string>): Promise<number> {
  const http = await vi.importActual<{
    request(url: URL, options: { method: string; headers: Record<string, string> }, callback: (response: {
      statusCode: number; resume(): void;
    }) => void): { end(body: string): void; on(event: string, callback: (error: Error) => void): void };
  }>('node:http');
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method: 'POST', headers }, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on('error', reject);
    request.end('{"url":"https://resource.example/image"}');
  });
}
