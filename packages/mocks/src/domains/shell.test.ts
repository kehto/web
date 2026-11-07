import { describe, expect, it } from 'vitest';

import type { MockDomainEntry, NapSpecRef } from '../core/types.js';
import { MOCK_SHELL_RUNTIME_DOMAINS, SHELL_MOCK_ENTRY, SHELL_SPEC_REF, mockShellEnvironmentDomains } from './shell.js';

const spec: NapSpecRef = { nap: 'NAP-X', status: 'draft', source: 'pr', pr: 1, sha: 'deadbeef', path: 'naps/NAP-X.md' };
const row = (domain: string, kind: MockDomainEntry['kind']): MockDomainEntry => ({ domain, kind, spec });

describe('NAP-SHELL entry', () => {
  it('records the merged master spec and a runtime-owned note without a factory', () => {
    expect(SHELL_SPEC_REF).toEqual({ nap: 'NAP-SHELL', status: 'merged', source: 'master', sha: '43cb3a4e8555', path: 'naps/NAP-SHELL.md' });
    expect(SHELL_MOCK_ENTRY).toMatchObject({ domain: 'shell', kind: 'runtime-owned', spec: SHELL_SPEC_REF });
    expect(SHELL_MOCK_ENTRY.create).toBeUndefined();
    expect(SHELL_MOCK_ENTRY.note).toContain('mockShellEnvironmentDomains');
  });

  it('always lists shell, storage, and inc even for an empty registry', () => {
    expect(MOCK_SHELL_RUNTIME_DOMAINS).toEqual(['shell', 'storage', 'inc']);
    expect(mockShellEnvironmentDomains([])).toEqual(['shell', 'storage', 'inc']);
  });

  it('adds service, extension, and adapter domains in registry order and drops posture/runtime-owned rows', () => {
    const domains = mockShellEnvironmentDomains([
      row('class-1', 'posture'),
      row('serial', 'service'),
      row('inc', 'runtime-owned'),
      row('torrent', 'extension'),
      row('storage', 'adapter'),
      row('ble', 'service'),
      row('class', 'extension'),
      row('shell', 'runtime-owned'),
      row('serial', 'service'),
    ]);
    expect(domains).toEqual(['shell', 'storage', 'inc', 'serial', 'torrent', 'ble', 'class']);
    expect(domains).not.toContain('class-1');
  });
});
