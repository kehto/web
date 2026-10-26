import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DEMO_HOOKS_PATH = fileURLToPath(
  new URL('../../apps/playground/src/demo-hooks.ts', import.meta.url),
);

function demoHooksSource(): string {
  return readFileSync(DEMO_HOOKS_PATH, 'utf8');
}

describe('playground resource transport boundary', () => {
  it('requires an approved network callback before resource fetches and fails closed for redirects', () => {
    const source = demoHooksSource();
    const authorization = source.indexOf('return await init.authorizeNetwork(url, async (networkSignal) => {');
    const fetch = source.indexOf('const response = await fetch(url, {', authorization);

    expect(authorization).toBeGreaterThanOrEqual(0);
    expect(fetch).toBeGreaterThan(authorization);
    expect(source).toContain("if (!init.authorizeNetwork) throw new Error('network-unavailable');");
    expect(source).toContain("redirect: 'manual'");
    expect(source).toContain("throw new Error('redirect-not-supported');");
  });

  it('does not retain removed grant or identity hooks outside the runtime authorization boundary', () => {
    const source = demoHooksSource();

    expect(source).not.toContain('isOriginGranted:');
    expect(source).not.toContain('getConnectGrants:');
    expect(source).not.toContain('resolveIdentity:');
    expect(source).not.toContain('STATIC_CONNECT_GRANTS');
  });
});
