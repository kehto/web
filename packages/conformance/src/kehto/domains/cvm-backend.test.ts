import { computeCvmToolSchemaHash } from '@kehto/services';
import { describe, expect, it } from 'vitest';
import { CVM_FIXTURE_TOOL } from '../../fixtures/cvm.js';
import { CVM_FIXTURE_TOOL_HASH } from './cvm.js';

describe('CVM conformance backend', () => {
  it('pins the CEP-15 hash of the fixture tool the in-memory server lists', async () => {
    const tool = structuredClone(CVM_FIXTURE_TOOL) as { name: string; inputSchema: Record<string, unknown> };
    expect(await computeCvmToolSchemaHash(tool)).toBe(CVM_FIXTURE_TOOL_HASH);
  });
});
