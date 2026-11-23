import { describe, expect, expectTypeOf, it } from 'vitest';
import type * as Core from '@napplet/core';
import type { CvmRegistryCallMessage, CvmRegistryDescribeResultMessage, CvmRegistryHasMessage } from '@napplet/nap/cvm/types';
import type {
  CvmRegistryCallOptions, CvmRegistryEntry, CvmRegistryOptions, CvmRegistryQuery, CvmRegistrySelector, CvmRegistryTool,
} from './cvm-registry-types.js';

const HASH = 'a'.repeat(64);

describe('canonical CVM registry contracts', () => {
  it('re-exports the published core contracts unchanged (kehto/web#441)', () => {
    expectTypeOf<CvmRegistrySelector>().toEqualTypeOf<Core.CvmRegistrySelector>();
    expectTypeOf<CvmRegistryEntry>().toEqualTypeOf<Core.CvmRegistryEntry>();
    expectTypeOf<CvmRegistryTool>().toEqualTypeOf<Core.CvmRegistryTool>();
    expectTypeOf<CvmRegistryOptions>().toEqualTypeOf<Core.CvmRegistryOptions>();
    expectTypeOf<CvmRegistryCallOptions>().toEqualTypeOf<Core.CvmRegistryCallOptions>();
    expectTypeOf<CvmRegistryQuery>().toEqualTypeOf<Core.CvmRegistryQuery>();
  });

  it('keeps the selector envelopes from NAP-CVM PR #31 @ 28cf1bdb', () => {
    // The probe from napplet/web#336: nap 0.40.0 rejected `selector` here.
    const has = { type: 'cvm.registry.has', id: 'probe', selector: { family: 'example.rooms.v1' } } satisfies CvmRegistryHasMessage;
    const call = {
      type: 'cvm.registry.call', id: 'call', selector: { schemaHash: HASH }, tool: 'get_weather',
      options: { server: { pubkey: 'b'.repeat(64) }, cache: 'no-store', payment: 'deny', timeoutMs: 1000, initialize: true },
    } satisfies CvmRegistryCallMessage;
    expectTypeOf<CvmRegistryHasMessage['selector']>().toEqualTypeOf<CvmRegistrySelector>();
    expectTypeOf<Extract<keyof CvmRegistryHasMessage, 'family'>>().toEqualTypeOf<never>();
    expectTypeOf<Extract<keyof CvmRegistryOptions, 'schemaHash'>>().toEqualTypeOf<never>();
    // @ts-expect-error at least one selector field is required
    const empty: CvmRegistrySelector = {};
    // @ts-expect-error the family-only carrier is not a wire shape
    const familyOnly: CvmRegistryHasMessage = { type: 'cvm.registry.has', id: 'old', family: 'example.rooms.v1' };
    expect([empty, familyOnly]).toHaveLength(2);
    expect(has.selector).toEqual({ family: 'example.rooms.v1' });
    expect(call.selector).toEqual({ schemaHash: HASH });
  });

  it('requires per-tool hashes and schemaHashes on entries, with an optional family label', () => {
    const tool = { name: 'get_weather', inputSchema: { type: 'object' }, schemaHash: HASH } satisfies CvmRegistryTool;
    const entry = { schemaHashes: [HASH], tools: [tool] } satisfies CvmRegistryEntry;
    const reply = { type: 'cvm.registry.describe.result', id: 'd', entry } satisfies CvmRegistryDescribeResultMessage;
    expectTypeOf<CvmRegistryEntry['family']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Extract<keyof CvmRegistryEntry, 'schemaHash'>>().toEqualTypeOf<never>();
    // @ts-expect-error schemaHashes is required
    const missing: CvmRegistryEntry = { family: 'weather', tools: [tool] };
    // @ts-expect-error every tool carries its verified hash
    const unhashed: CvmRegistryTool = { name: 'get_weather', inputSchema: {} };
    expect([missing, unhashed]).toHaveLength(2);
    expect(reply.entry.schemaHashes).toEqual([HASH]);
  });
});
