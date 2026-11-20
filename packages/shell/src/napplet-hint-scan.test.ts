import { describe, expect, it } from 'vitest';
import { assertNappletHasNoResourceHint, nappletMarkupHasResourceHint } from './napplet-hint-scan.js';

// The unit suite runs without a DOM, so these cases exercise the conservative lexical fallback. The parser path runs
// in real browsers through Paja (tests/e2e/shell-resource-hints.spec.ts covers the scripted paths).
describe('host-side napplet resource-hint scan', () => {
  it.each([
    '<link rel="preconnect" href="https://collector.example">',
    '<link rel=dns-prefetch href="//collector.example">',
    '<LINK REL="prerender" HREF="https://collector.example/x">',
    '<link href="https://collector.example" rel="icon preconnect">',
    '<template><link rel="prerender" href="https://collector.example"></template>',
    '<link rel="pre&#99;onnect" href="https://collector.example">',
  ])('rejects markup that declares a resource hint: %s', (html) => {
    expect(nappletMarkupHasResourceHint(html)).toBe(true);
    expect(() => assertNappletHasNoResourceHint(html)).toThrow(/dns-prefetch, preconnect or prerender/);
  });

  it.each([
    '<p>hello</p>',
    '<link rel="icon" href="data:,">',
    '<link rel="stylesheet" href="data:text/css,">',
    '<p>we preconnect nothing</p>',
  ])('accepts markup without a resource hint: %s', (html) => {
    expect(nappletMarkupHasResourceHint(html)).toBe(false);
    expect(() => assertNappletHasNoResourceHint(html)).not.toThrow();
  });

  it('treats non-string input as hint-free', () => {
    expect(nappletMarkupHasResourceHint(undefined as unknown as string)).toBe(false);
  });
});
