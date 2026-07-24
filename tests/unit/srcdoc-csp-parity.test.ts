import { describe, expect, it } from 'vitest';
import { injectCspMeta } from '../../apps/playground/src/napplet-resolver.js';
import { injectPajaRuntimeCsp } from '../../packages/paja/src/runtime-resolver.js';

function policyFrom(html: string): string {
  const match = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
  if (!match) throw new Error('CSP meta was not injected.');
  return match[1];
}

describe('verified srcdoc CSP parity', () => {
  it.each([
    { origins: [] },
    { origins: ['https://b.example', 'https://a.example', 'https://b.example'] },
  ])('keeps playground and Paja byte-identical for grants %#', ({ origins }) => {
    const playground = policyFrom(injectCspMeta('<html><head></head></html>', origins));
    const paja = policyFrom(injectPajaRuntimeCsp('<html><head></head></html>', origins));

    expect(paja).toBe(playground);
    const connect = /connect-src ([^;]+)/.exec(paja)?.[1];
    expect(connect).toBe(origins.length === 0 ? "'none'" : 'https://a.example https://b.example');
    expect(paja).toMatch(/frame-ancestors 'self'$/);
  });
});
