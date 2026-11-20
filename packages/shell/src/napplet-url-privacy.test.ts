import { describe, expect, it } from 'vitest';
import {
  denyNappletReferrer, hasNappletReferrerPolicy, NAPPLET_REFERRER_POLICY, renderNappletHostBase,
  renderNappletReferrerPolicyMeta,
} from './napplet-url-privacy.js';

function frame(initial?: string) {
  const attributes = new Map<string, string>(initial === undefined ? [] : [['referrerpolicy', initial]]);
  return {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => { attributes.set(name, value); },
  };
}

describe('napplet embedding-URL privacy', () => {
  it('sets no-referrer on the frame and recognizes it', () => {
    const target = frame();
    expect(hasNappletReferrerPolicy(target)).toBe(false);
    denyNappletReferrer(target);
    expect(target.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(hasNappletReferrerPolicy(target)).toBe(true);
  });

  it('replaces a weaker frame policy and ignores case when checking', () => {
    const target = frame('unsafe-url');
    expect(hasNappletReferrerPolicy(target)).toBe(false);
    denyNappletReferrer(target);
    expect(hasNappletReferrerPolicy(target)).toBe(true);
    expect(hasNappletReferrerPolicy(frame(' No-Referrer '))).toBe(true);
    expect(hasNappletReferrerPolicy(frame('origin'))).toBe(false);
  });

  it('renders the host-page referrer meta and base element', () => {
    expect(NAPPLET_REFERRER_POLICY).toBe('no-referrer');
    expect(renderNappletReferrerPolicyMeta()).toBe('<meta name="referrer" content="no-referrer">');
    expect(renderNappletHostBase()).toBe('<base href="./">');
  });
});
