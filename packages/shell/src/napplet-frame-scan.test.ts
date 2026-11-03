import { describe, expect, it } from 'vitest';
import { assertNappletHasNoFrame, nappletMarkupHasFrame } from './napplet-frame-scan.js';

// The unit suite runs without a DOM, so the scan uses its conservative lexical
// fallback. These cases are unambiguous in both modes: real frame tags are
// rejected, and markup with no frame-tag token at all passes. The accurate
// parser path (comments/strings/attributes ignored) is exercised in real
// Chromium by tests/e2e/shell-csp.spec.ts.
describe('host-side napplet frame scan', () => {
  it.each([
    '<iframe srcdoc="x"></iframe>',
    '<IFRAME></IFRAME>',
    '<iframe\n></iframe>',
    '<template><iframe></iframe></template>',
    '<svg><foreignObject><iframe></iframe></foreignObject></svg>',
    '<object data="about:blank"></object>',
    '<embed src="about:blank">',
    '<frameset><frame></frameset>',
    '<!doctype html><html><body><p>intro</p><iframe></iframe></body></html>',
    '<portal src="https://a.example"></portal>',
  ])('rejects markup that declares a nested browsing context: %s', (html) => {
    expect(nappletMarkupHasFrame(html)).toBe(true);
    expect(() => assertNappletHasNoFrame(html)).toThrow(/nested browsing context/);
  });

  it.each([
    '<p>hello</p>',
    '<div data-note="no such element here"></div>',
    '<article><section><h1>frameless</h1></section></article>',
    '<script>const s = "if" + "rame"</script>',
    '<img src="data:,">',
  ])('passes frameless markup: %s', (html) => {
    expect(nappletMarkupHasFrame(html)).toBe(false);
    expect(() => assertNappletHasNoFrame(html)).not.toThrow();
  });

  it('treats non-string input as frameless rather than throwing', () => {
    expect(nappletMarkupHasFrame(undefined as unknown as string)).toBe(false);
  });
});
