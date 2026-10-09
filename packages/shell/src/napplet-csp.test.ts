import { describe, expect, it } from 'vitest';
import { buildNappletCsp, injectNappletCsp, type NappletCspDirectives } from './napplet-csp.js';
import { prepareNappletSrcdoc } from './napplet-srcdoc.js';

describe('host-customizable NIP-5D CSP', () => {
  it('defaults to the upstream baseline with WASM and no direct connections', () => {
    const policy = buildNappletCsp();
    expect(policy).toContain("script-src 'unsafe-inline' 'wasm-unsafe-eval'");
    for (const directive of ['default-src', 'connect-src', 'worker-src', 'frame-src', 'object-src']) {
      expect(policy).toContain(`${directive} 'none'`);
    }
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/frame-ancestors|sandbox|report-uri|prefetch-src/);
  });

  it('allows host changes without freezing the example baseline', () => {
    const directives = Object.freeze({
      'media-src': Object.freeze(['blob:']),
      'img-src': Object.freeze(['https://images.example']),
      'script-src': Object.freeze(["'unsafe-inline'"]),
      'script-src-attr': Object.freeze(["'none'"]),
    });
    const policy = buildNappletCsp({ directives });
    expect(policy).toContain('media-src blob:');
    expect(policy).toContain('img-src https://images.example');
    expect(policy).not.toContain('wasm-unsafe-eval');
    expect(buildNappletCsp()).toContain("media-src 'none'");
  });

  it('canonicalizes grants and permits narrowing them', () => {
    const connectOrigins = ['https://B.example:443/', 'wss://relay.example', 'https://b.example'];
    expect(buildNappletCsp({ connectOrigins })).toContain('connect-src https://b.example wss://relay.example');
    expect(buildNappletCsp({
      connectOrigins, directives: { 'connect-src': ['https://b.example/'] },
    })).toContain('connect-src https://b.example;');
    expect(buildNappletCsp({
      connectOrigins, directives: { 'connect-src': ["'none'"] },
    })).toContain("connect-src 'none'");
  });

  it.each([
    '*', 'https:', 'https://*.example', "'self'", 'data:', 'blob:https://a.example/id',
    'https://a.example/path', 'https://a.example?query', 'https://a.example#hash',
    'https://user:pass@a.example', 'https://a.example:*', 'https://a.example\n',
    'https://a.example;script-src', 'https://a.example%3Bscript-src', 'https://a.example\\',
  ])('rejects non-origin connection grant %s', (origin) => {
    expect(() => buildNappletCsp({ connectOrigins: [origin] })).toThrow(/exact.*origin/);
  });

  it('rejects ungranted connections and fallback attempts', () => {
    expect(() => buildNappletCsp({
      directives: { 'connect-src': ['https://ungranted.example'] },
    })).toThrow(/not granted/);
    expect(() => buildNappletCsp({ directives: { 'connect-src': [] } })).toThrow(/nonempty/);
    expect(buildNappletCsp({ directives: { 'default-src': ['https:'] } }))
      .toContain("connect-src 'none'");
  });

  it.each(['script-src', 'script-src-elem', 'script-src-attr', 'default-src'])(
    'rejects broad JavaScript evaluation in %s', (directive) => {
      expect(() => buildNappletCsp({ directives: { [directive]: ["'unsafe-eval'"] } }))
        .toThrow(/forbids 'unsafe-eval'/);
    },
  );

  it.each(['frame-ancestors', 'sandbox', 'report-uri', 'report-to', 'script-src ', 'unknown'])(
    'rejects unsupported or misspelled directive %s', (directive) => {
      expect(() => buildNappletCsp({ directives: { [directive]: ["'none'"] } }))
        .toThrow(/Unsupported meta CSP directive/);
    },
  );

  it.each([
    ["'none'"], ["'unsafe-inline'", "'nonce-YWJj'"],
    ["'unsafe-inline'", "'sha256-YWJj'"], ["'unsafe-inline'", "'strict-dynamic'"],
  ])('rejects policies that suppress the mandatory bootstrap: %j', (...sources) => {
    for (const directive of ['script-src', 'script-src-elem']) {
      expect(() => buildNappletCsp({ directives: { [directive]: sources } }))
        .toThrow(/inline namespace bootstrap/);
    }
  });

  it.each(['data:;connect-src *', 'data: blob:', '<script>', '"', "'misspelled'", 'https://a.example,b.example'])(
    'rejects source-list injection or invalid keyword %s', (source) => {
      expect(() => buildNappletCsp({ directives: { 'img-src': [source] } })).toThrow(/Invalid CSP/);
    },
  );

  it('rejects ambiguous none lists and malformed JavaScript options', () => {
    expect(() => buildNappletCsp({ directives: { 'img-src': ["'none'", 'blob:'] } })).toThrow(/cannot combine/);
    expect(() => buildNappletCsp({ directives: { 'img-src': 'blob:' } as unknown as NappletCspDirectives }))
      .toThrow(/nonempty/);
  });
});

describe('verified srcdoc preparation', () => {
  it.each([
    '<!doctype html><html><head><title>napplet</title></head><body></body></html>',
    '<html><body>napplet</body></html>',
    '<script>window.authored = true</script><head></head>',
    '<!-- <head> decoy --><script>window.authored = true</script>',
    '<!--><script>window.authored = true</script><!-- <head> -->',
    '<html lang="en"><head data-name=">fake"><title>napplet</title></head>',
    '<template><head></head></template><script>window.authored = true</script>',
    '<script>const decoy = "<head>"</script>',
  ])('places trusted content before authored content: %s', (html) => {
    const srcdoc = prepareNappletSrcdoc(html, { domains: [] });
    const meta = /<meta http-equiv="Content-Security-Policy"[^>]*>/;
    expect(srcdoc).toMatch(/<head><meta http-equiv="Content-Security-Policy"/);
    expect(srcdoc.indexOf('Content-Security-Policy')).toBeLessThan(srcdoc.indexOf('data-kehto-nip5d-injection'));
    // Removing only the injected head content/wrapper recovers the signed input.
    const withoutInjection = srcdoc.replace(meta, '').replace(/<script data-kehto-nip5d-injection>[\s\S]*?<\/script>/, '');
    expect([withoutInjection, withoutInjection.replace('<head></head>', '')]).toContain(html);
  });

  it('preserves authored policies and escapes attribute values', () => {
    const html = '<html><head><meta http-equiv="Content-Security-Policy" content="img-src data:"></head></html>';
    const srcdoc = injectNappletCsp(html, { directives: { 'img-src': ['https://images.example/a?x=1&y=2'] } });
    expect(srcdoc.match(/http-equiv="Content-Security-Policy"/g)).toHaveLength(2);
    expect(srcdoc).toContain('content="img-src data:"');
    expect(srcdoc).toContain('https://images.example/a?x=1&amp;y=2');
  });
});
