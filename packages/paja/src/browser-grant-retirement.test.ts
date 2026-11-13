import { describe, expect, it } from 'vitest';
import type { PermissionGrant } from '@kehto/runtime';
import { revokedPajaTabIds } from './browser-grant-retirement.js';
import { createPajaLocalTarget } from './local-target.js';
import type { PajaRuntimeTab } from './browser-runtime-tabs.js';
import type { PajaHostConfig } from './options.js';

const config = {
  window: { id: 'paja', dTag: 'target', aggregateHash: '0'.repeat(64) },
} as PajaHostConfig;

describe('Paja exact grant retirement', () => {
  it('closes only tabs bound to the revoked development artifact', async () => {
    const first = await createPajaLocalTarget({ name: 'first.html', text: '<html>first</html>' });
    const second = await createPajaLocalTarget({ name: 'second.html', text: '<html>second</html>' });
    const tabs = [
      { id: 'first', resolvedTarget: first },
      { id: 'second', resolvedTarget: second },
    ] as PajaRuntimeTab[];
    const grant = {
      principal: { kind: 'development', target: 'local-file:first.html', artifactHash: first.aggregateHash },
      permission: { category: 'interface', domain: 'resource', operation: 'access', scope: { kind: 'exact', value: 'resource' } },
      effect: 'allow', lifetime: 'session', id: 'first-grant', sessionId: 'first-session',
    } as PermissionGrant;
    expect(revokedPajaTabIds(config, tabs, grant)).toEqual(['first']);
    expect(revokedPajaTabIds(config, tabs, { ...grant, principal: { ...grant.principal, artifactHash: second.aggregateHash } })).toEqual([]);
  });
});
