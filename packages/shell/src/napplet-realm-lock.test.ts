import { describe, expect, it } from 'vitest';
import { needsTrustedTypes, renderNappletRealmLock } from './napplet-realm-lock.js';

describe('napplet realm locks', () => {
  it('renders a no-op when no lock is on', () => {
    expect(renderNappletRealmLock(undefined)).toBe('(function(){})');
    expect(renderNappletRealmLock({})).toBe('(function(){})');
    expect(renderNappletRealmLock({ nestedContextLock: false, resourceHintLock: false })).toBe('(function(){})');
    expect(needsTrustedTypes(undefined)).toBe(false);
  });

  it('installs only the requested locks and one shared default policy', () => {
    const frame = renderNappletRealmLock({ nestedContextLock: true });
    expect(frame).toContain('nested browsing contexts');
    expect(frame).not.toContain('prerender hints');
    expect(frame.match(/createPolicy\(/g)).toHaveLength(1);

    const hints = renderNappletRealmLock({ resourceHintLock: true });
    expect(hints).toContain('dns-prefetch, preconnect or prerender');
    expect(hints).not.toContain('nested browsing contexts');

    const both = renderNappletRealmLock({ nestedContextLock: true, resourceHintLock: true });
    expect(both).toContain('nested browsing contexts');
    expect(both).toContain('dns-prefetch, preconnect or prerender');
    expect(both.match(/createPolicy\(/g)).toHaveLength(1);
  });

  it('removes XSLTProcessor under either lock', () => {
    expect(renderNappletRealmLock({ nestedContextLock: true })).toMatch(/["']XSLTProcessor["']/);
    expect(renderNappletRealmLock({ resourceHintLock: true })).toMatch(/["']XSLTProcessor["']/);
  });

  it('requires the Trusted Types directives for either lock', () => {
    expect(needsTrustedTypes({ nestedContextLock: true })).toBe(true);
    expect(needsTrustedTypes({ resourceHintLock: true })).toBe(true);
  });

  it('serializes into a function that parses on its own', () => {
    const source = renderNappletRealmLock({ nestedContextLock: true, resourceHintLock: true });
    expect(() => new Function(`return ${source};`)).not.toThrow();
  });
});
