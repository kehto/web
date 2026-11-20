import { describe, expect, it } from 'vitest';
import { pajaMultiplayerNamespace } from './browser-multiplayer-identity.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';

describe('verified multiplayer namespaces', () => {
  const publisher = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
  // Only the resolver's already-verified address fields are relevant to this pure derivation.
  const resolved = (kind: number, tags: string[][] = [], pubkey = publisher) => ({
    event: { kind, pubkey, tags }, dTag: 'arena:one', aggregateHash: 'build-a',
  }) as unknown as PajaResolvedPointer;
  it('separates publishers and root/named addresses while retaining version-independent identity', () => {
    const target = resolved(35129);
    expect(pajaMultiplayerNamespace(target)).toBe(`${publisher}:35129:arena:one`);
    expect(pajaMultiplayerNamespace({ ...target, aggregateHash: 'build-b' })).toBe(pajaMultiplayerNamespace(target));
    expect(pajaMultiplayerNamespace(resolved(15129))).not.toBe(pajaMultiplayerNamespace(target));
    expect(pajaMultiplayerNamespace(null)).toBeUndefined();
  });
  it('shares same-publisher snapshots and isolates third-party snapshot assertions', () => {
    const address = `35129:${publisher}:arena:one`;
    expect(pajaMultiplayerNamespace(resolved(5129, [['a', address]]))).toBe(`${publisher}:35129:arena:one`);
    expect(pajaMultiplayerNamespace(resolved(5129, [['a', address]], 'b'.repeat(64)))).toBe(`${'b'.repeat(64)}:5129:${address}`);
    expect(pajaMultiplayerNamespace(resolved(5129))).toBe('');
  });
});
