import { describe, expect, it } from 'vitest';
import { PAJA_TARGET_RESOURCE_HINT, findExternalAssetReferences, planTargetNetwork } from './target-network.js';

// kehto/web#447. Authority: NAP-RESOURCE PR #80 at
// ae5b9c64ab8a4d8909f288829a01e99d6bd713bc and its web resource binding.
describe('target-URL network plan', () => {
  it('isolates a document that requires resource and stays quiet when it is self-contained', () => {
    const plan = planTargetNetwork('<meta name="napplet-requires" content="theme resource"><script>1</script><img src="data:image/png;base64,AA==">');
    expect(plan).toMatchObject({ mode: 'isolated', resource: 'required', blockedReferences: [], hint: null });
    expect(plan.detail).toContain('network-isolated snapshot');
  });

  it('names every reference an isolated frame cannot load', () => {
    const plan = planTargetNetwork([
      '<meta name="napplet-requires" content="resource">',
      '<link rel="stylesheet" href="/style.css"><link rel="canonical" href="https://example.test/">',
      '<script type="module" src="./src/main.ts"></script><img src=https://cdn.example.test/a.png>',
      '<img src="blob:x"><a href="/elsewhere">link</a><video src="#t=1"></video>',
    ].join(''));
    expect(plan.blockedReferences).toEqual(['/style.css', './src/main.ts', 'https://cdn.example.test/a.png']);
    expect(plan.hint).toContain('These references will not load: /style.css, ./src/main.ts, https://cdn.example.test/a.png.');
    expect(plan.hint).toContain(PAJA_TARGET_RESOURCE_HINT);
  });

  it('keeps optional resource live and explains the omission', () => {
    const plan = planTargetNetwork('<meta name="napplet-optional" content="resource"><script src="/main.js"></script>');
    expect(plan).toMatchObject({ mode: 'live', resource: 'optional', blockedReferences: [], hint: PAJA_TARGET_RESOURCE_HINT });
    expect(plan.detail).toContain('leaves `window.napplet.resource` out');
  });

  it('reports nothing for a document that does not declare resource', () => {
    expect(planTargetNetwork('<meta name="napplet-requires" content="relay"><script src="/main.js"></script>'))
      .toEqual({ mode: 'live', resource: 'undeclared', blockedReferences: [], detail: null, hint: null });
    expect(planTargetNetwork('<script src="/main.js"></script>').mode).toBe('live');
  });

  it('caps the reported references at eight', () => {
    const html = Array.from({ length: 12 }, (_, index) => `<img src="/${index}.png">`).join('');
    expect(findExternalAssetReferences(html)).toHaveLength(8);
  });
});
