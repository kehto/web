import { describe, expect, it } from 'vitest';
import { hasNappletFramePolicy, NAPPLET_FRAME_POLICY, renderNappletFramePolicyMeta } from './frame-policy.js';

function host(...contents: string[]) {
  return { querySelectorAll: () => contents.map((content) => ({ content })) } as unknown as Pick<Document, 'querySelectorAll'>;
}

describe('napplet frame policy', () => {
  it('renders the host-page meta element', () => {
    expect(NAPPLET_FRAME_POLICY).toBe("frame-src 'none'");
    expect(renderNappletFramePolicyMeta()).toBe(`<meta http-equiv="Content-Security-Policy" content="frame-src 'none'">`);
  });

  it('finds the directive alone or within a larger policy, and nothing weaker', () => {
    expect(hasNappletFramePolicy(host("frame-src 'none'"))).toBe(true);
    expect(hasNappletFramePolicy(host("img-src 'self'; frame-src 'none'"))).toBe(true);
    expect(hasNappletFramePolicy(host())).toBe(false);
    expect(hasNappletFramePolicy(host("frame-src 'self'"))).toBe(false);
  });
});
