import { describe, expect, it } from 'vitest';
import {
  injectNappletNamespacePrelude,
  renderNappletNamespacePrelude,
} from './napplet-namespace.js';

function runPrelude(script: string, target: { napplet?: Record<string, unknown> }): void {
  const source = script.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
  if (!source) {
    throw new Error('missing namespace prelude source');
  }
  new Function('window', source)(target);
}

describe('NIP-5D napplet namespace prelude', () => {
  it('renders available bare NAP domains without legacy supports helpers', () => {
    const script = renderNappletNamespacePrelude({
      domains: ['relay', 'identity', 'relay', 'inc:NAP-01', 'perm:popups', 'theme'],
    });

    expect(script).toContain('data-kehto-nip5d-injection');
    expect(script).toContain('["relay","identity","theme"]');
    expect(script).not.toContain('shell.supports');
    expect(script).not.toContain('perm:popups');
    expect(script).not.toContain('inc:NAP-01');
    expect(script).toContain("set(value)");
    expect(script).toContain("buildNappletNamespace(value)");
  });

  it('escapes script-breaking domain text', () => {
    const script = renderNappletNamespacePrelude({ domains: ['x</script><script>bad</script>'] });

    expect(script).toContain('\\u003c/script>');
    expect(script).not.toContain('x</script><script>bad</script>');
  });

  it('places the prelude after CSP and before authored scripts', () => {
    const html = [
      '<html><head>',
      '<meta http-equiv="Content-Security-Policy" content="connect-src none">',
      '<script src="/assets/app.js"></script>',
      '</head><body></body></html>',
    ].join('');

    const out = injectNappletNamespacePrelude(html, { domains: ['relay'] });

    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(
      out.indexOf('data-kehto-nip5d-injection'),
    );
    expect(out.indexOf('data-kehto-nip5d-injection')).toBeLessThan(
      out.indexOf('src="/assets/app.js"'),
    );
  });

  it('creates a head prelude when an artifact has no head element', () => {
    const out = injectNappletNamespacePrelude('<html><body>x</body></html>', { domains: ['notify'] });

    expect(out).toContain('<head><script data-kehto-nip5d-injection>');
    expect(out.indexOf('data-kehto-nip5d-injection')).toBeLessThan(out.indexOf('<body>'));
  });

  it('filters napplet-owned namespace assignments through the injected domain allowlist', () => {
    const target: { napplet?: Record<string, unknown> } = {};
    const relay = { subscribe: () => undefined };
    const upload = { put: () => undefined };
    const shell = { supports: () => true };

    runPrelude(renderNappletNamespacePrelude({ domains: ['relay', 'identity'] }), target);

    expect(target.napplet).toMatchObject({
      relay: {},
      identity: {},
    });
    expect(target.napplet?.upload).toBeUndefined();

    target.napplet = {
      relay,
      upload,
      shell,
    };

    expect(target.napplet?.relay).toBe(relay);
    expect(target.napplet?.identity).toEqual({});
    expect(target.napplet?.shell).toBe(shell);
    expect(target.napplet?.upload).toBeUndefined();
    expect(Object.keys(target.napplet ?? {})).toEqual(['relay', 'identity', 'shell']);
    expect(target.napplet?.__kehtoInjectedDomains).toEqual(['relay', 'identity']);
  });
});
