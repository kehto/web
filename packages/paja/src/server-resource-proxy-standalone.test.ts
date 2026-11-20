import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePajaProxyOrigin, startPajaResourceProxy, type PajaResourceProxy } from './server-resource-proxy.js';
import { runPajaCli } from './cli.js';

// NAP-RESOURCE napplet/naps#80 @ ae5b9c6: the runtime is an SSRF boundary and
// DNS-time private-IP checks are mandatory. The standalone proxy is how the
// static build gets them.
const transport = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: transport.lookup }));
vi.mock('node:http', async (original) => ({ ...await original<object>(), request: transport.request }));
vi.mock('node:https', () => ({ request: transport.request }));

const ORIGIN = 'https://kehto.github.io';

function reply(status = 200, headers: Record<string, string> = {}, body = new Uint8Array([0x89, 0x50, 0x4e, 0x47])) {
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

let proxy: PajaResourceProxy | undefined;
beforeEach(async () => {
  vi.clearAllMocks();
  transport.lookup.mockResolvedValue([{ address: '93.184.215.14', family: 4 }]);
  reply();
  proxy = await startPajaResourceProxy({ allowedOrigins: [ORIGIN], host: '127.0.0.1', port: 0 });
});
afterEach(async () => { await proxy?.close(); proxy = undefined; });

const post = (url: string, origin = ORIGIN, path = '') => fetch(`${proxy!.url}${path}`, {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ url }),
});

describe('startPajaResourceProxy', () => {
  it('answers an allowed origin with upstream bytes, CORS and the upstream marker', async () => {
    const response = await post('https://image.example/a.png');
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(response.headers.get('vary')).toBe('Origin');
    expect(response.headers.get('access-control-expose-headers')).toContain('x-kehto-resource-redirect');
    expect(response.headers.get('x-kehto-resource-upstream')).toBe('1');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  });

  it('answers the CORS preflight only for an allowed origin', async () => {
    const preflight = await fetch(proxy!.url, { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST' } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toBe('POST');
    expect(preflight.headers.get('access-control-allow-headers')).toBe('content-type');
    const stranger = await fetch(proxy!.url, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    expect(stranger.status).toBe(403);
    expect(stranger.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('refuses other origins before any DNS lookup', async () => {
    const response = await post('https://image.example/a.png', 'https://evil.example');
    expect(response.status).toBe(403);
    expect(transport.lookup).not.toHaveBeenCalled();
  });

  it('blocks destinations that resolve to private addresses (DNS-time check)', async () => {
    transport.lookup.mockResolvedValue([{ address: '192.168.1.10', family: 4 }]);
    const response = await post('https://printer.example/admin');
    expect(response.status).toBe(502);
    expect(response.headers.get('x-kehto-resource-upstream')).toBeNull();
    expect(transport.request).not.toHaveBeenCalled();
  });

  it('hands redirects back to the browser instead of following them', async () => {
    reply(302, { location: 'https://cdn.example/b.png' });
    const response = await post('https://image.example/a.png', ORIGIN, '__kehto/resource');
    expect(response.headers.get('x-kehto-resource-redirect')).toBe('1');
    expect(await response.json()).toEqual({ status: 302, location: 'https://cdn.example/b.png' });
  });

  it('marks an upstream 404 so the browser can tell it from a proxy refusal', async () => {
    reply(404);
    const upstream = await post('https://image.example/missing.png');
    expect(upstream.status).toBe(404);
    expect(upstream.headers.get('x-kehto-resource-upstream')).toBe('1');
    const wrongPath = await post('https://image.example/a.png', ORIGIN, 'elsewhere');
    expect(wrongPath.status).toBe(404);
    expect(wrongPath.headers.get('x-kehto-resource-upstream')).toBeNull();
  });

  it('rejects non-HTTP destinations and credentials in URLs', async () => {
    expect((await post('file:///etc/passwd')).status).toBe(400);
    expect((await post('https://user:pass@image.example/a.png')).status).toBe(400);
  });

  it('refuses to start without an allowlist or with a non-origin entry', async () => {
    await expect(startPajaResourceProxy({ allowedOrigins: [], host: '127.0.0.1', port: 0 })).rejects.toThrow('at least one --allow-origin');
    expect(() => normalizePajaProxyOrigin('https://kehto.github.io/web/')).toThrow('bare origin');
    expect(normalizePajaProxyOrigin('https://kehto.github.io/')).toBe(ORIGIN);
  });

  it('starts from the CLI with the given origins and port', async () => {
    const start = vi.fn(async () => ({ url: 'http://127.0.0.1:8787/', close: async () => {} }));
    const out: string[] = [];
    const io = { stdout: { write: (text: string) => out.push(text) }, stderr: { write: (text: string) => out.push(text) } };
    await expect(runPajaCli(['resource-proxy', '--allow-origin', ORIGIN, '--port', '8787'], io as never, { startResourceProxy: start })).resolves.toBe(0);
    expect(start).toHaveBeenCalledWith({ allowedOrigins: [ORIGIN], host: '127.0.0.1', port: 8787 });
    await expect(runPajaCli(['resource-proxy', '--port', '8787'], io as never, { startResourceProxy: start })).resolves.toBe(1);
  });
});
