import { describe, expect, it } from 'vitest';

import {
  CONNECT_MOCK_ENTRY,
  CONNECT_SPEC_REF,
  connectOriginsFold,
  createMockConnectGate,
  createMockLoopbackNetwork,
  isCanonicalConnectOrigin,
  normalizeConnectOrigin,
  sha256Hex,
} from './connect.js';

describe('NAP-CONNECT mock', () => {
  it('registers as a runtime-owned domain without a wire factory', () => {
    expect(CONNECT_SPEC_REF).toEqual({ nap: 'NAP-CONNECT', status: 'draft', source: 'pr', pr: 19, sha: 'ec81a3a4a1fc', path: 'naps/NAP-CONNECT.md' });
    expect(CONNECT_MOCK_ENTRY.kind).toBe('runtime-owned');
    expect(CONNECT_MOCK_ENTRY.create).toBeUndefined();
    expect(CONNECT_MOCK_ENTRY.note).toContain('no connect.* envelopes');
  });

  it('hashes with SHA-256', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    // Two-block message.
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('reproduces the normative connect:origins fold fixture', () => {
    expect(connectOriginsFold(['wss://events.example.com', 'https://api.example.com', 'https://xn--caf-dma.example.com']))
      .toBe('cc7c1b1903fb23ecb909d2427e1dccd7d398a5c63dd65160edb0bb8b231aa742');
  });

  it('normalizes the conformance vectors', () => {
    const accepted: Array<[string, string]> = [
      ['HTTPS://api.example.com', 'https://api.example.com'],
      ['https://API.example.com', 'https://api.example.com'],
      ['https://api.example.com:8443', 'https://api.example.com:8443'],
      ['https://café.example.com', 'https://xn--caf-dma.example.com'],
      ['https://xn--caf-dma.example.com', 'https://xn--caf-dma.example.com'],
      ['https://日本.example.com', 'https://xn--wgv71a.example.com'],
      ['https://api.example.com', 'https://api.example.com'],
    ];
    for (const [input, origin] of accepted) expect(normalizeConnectOrigin(input)).toEqual({ ok: true, origin });
    const rejected = [
      'https://foo.com/', 'https://foo.com:443', 'wss://events.example.com:443', 'http://foo.com:80',
      'https://*.example.com', 'https://foo.com/api', 'https://foo.com?x=1', 'https://foo.com#top',
      'ftp://files.example.com', 'data:text/plain,hello', 'https://CAFÉ.example.com',
    ];
    for (const input of rejected) expect(normalizeConnectOrigin(input).ok, input).toBe(false);
    expect(normalizeConnectOrigin('https://foo.com/')).toEqual({ ok: false, reason: 'trailing slash' });
    expect(isCanonicalConnectOrigin('https://API.example.com')).toEqual({ ok: false, reason: 'origin is not canonical' });
    expect(isCanonicalConnectOrigin('https://api.example.com')).toEqual({ ok: true, origin: 'https://api.example.com' });
  });

  it('serves a grant once per (dTag, aggregateHash) and persists the decision', () => {
    const gate = createMockConnectGate();
    const manifest = { dTag: 'distro-browser', connectOrigins: ['https://api.example.org', 'wss://events.example.org'] };
    const first = gate.serve(manifest);
    expect(first.prompted).toBe(true);
    expect(first.granted).toBe(true);
    expect(first.origins).toEqual(['https://api.example.org', 'wss://events.example.org']);
    expect(first.csp).toBe('connect-src https://api.example.org wss://events.example.org');
    expect(first.meta).toBe('<meta name="napplet-connect-granted" content="https://api.example.org wss://events.example.org">');
    expect(first.aggregateHash).toBe(sha256Hex(connectOriginsFold(manifest.connectOrigins)));

    const again = gate.serve(manifest);
    expect(again.prompted).toBe(false);
    expect(again.granted).toBe(true);
    expect(gate.grants().get(`distro-browser:${first.aggregateHash}`)).toBe(true);

    // Changing the origin set changes the key and re-prompts.
    gate.approveNext(false);
    const rebuilt = gate.serve({ ...manifest, connectOrigins: ['https://api.example.org'] });
    expect(rebuilt.prompted).toBe(true);
    expect(rebuilt.aggregateHash).not.toBe(first.aggregateHash);
    expect(rebuilt).toMatchObject({ granted: false, origins: [], csp: "connect-src 'none'", meta: '<meta name="napplet-connect-granted" content="">' });

    expect(gate.revoke('distro-browser', first.aggregateHash)).toBe(true);
    expect(gate.revoke('distro-browser', first.aggregateHash)).toBe(false);
    gate.approveNext(false);
    expect(gate.serve(manifest).granted).toBe(false);
  });

  it('refuses invalid and cleartext origins per policy', () => {
    const gate = createMockConnectGate();
    expect(gate.serve({ dTag: 'x', connectOrigins: ['https://foo.com/'] }).refused).toBe('invalid connect origin "https://foo.com/": trailing slash');
    expect(gate.serve({ dTag: 'x', connectOrigins: ['http://mirror.example.org'] }).refused).toBe('cleartext origin http://mirror.example.org refused by operator policy');
    expect(gate.supports('nap:connect')).toBe(true);
    expect(gate.supports('connect:scheme:http')).toBe(false);
    expect(gate.supports('connect:scheme:ws')).toBe(false);
    expect(gate.supports('other')).toBe(false);

    const cleartext = createMockConnectGate({ allowCleartext: true });
    expect(cleartext.supports('connect:scheme:ws')).toBe(true);
    expect(cleartext.serve({ dTag: 'x', connectOrigins: ['ws://mirror.example.org'] }).granted).toBe(true);

    const none = gate.serve({ dTag: 'plain', connectOrigins: [] });
    expect(none).toMatchObject({ granted: false, prompted: false, origins: [] });
    gate.reset();
    expect(gate.grants().size).toBe(0);
  });

  it('loopback network allows only granted origins and echoes frames', () => {
    const served = createMockConnectGate().serve({ dTag: 'a', connectOrigins: ['wss://events.example.org', 'https://api.example.org:8443'] });
    const net = createMockLoopbackNetwork(served.origins);
    expect(net.open('https://evil.example.net/x')).toEqual({ ok: false, error: 'blocked-by-csp', origin: 'https://evil.example.net' });
    expect(net.open('https://api.example.org/x')).toEqual({ ok: false, error: 'blocked-by-csp', origin: 'https://api.example.org' });
    expect(net.open('not a url')).toEqual({ ok: false, error: 'invalid-url' });

    const opened = net.open('wss://events.example.org/feed?x=1');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const { socket } = opened;
    expect(socket.send('ping')).toBe(true);
    expect(socket.send('pong')).toBe(true);
    expect(socket.receive()).toBe('ping');
    expect(socket.receive()).toBe('pong');
    expect(socket.receive()).toBeUndefined();
    expect(socket.sent).toEqual(['ping', 'pong']);
    socket.close();
    socket.close();
    expect(socket.isOpen).toBe(false);
    expect(socket.send('late')).toBe(false);
    expect(net.sockets).toHaveLength(1);
    expect(net.open('https://api.example.org:8443/v1').ok).toBe(true);
  });
});
