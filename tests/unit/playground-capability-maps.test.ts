import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  DEMO_CAPABILITY_HINTS,
  DEMO_CAPABILITY_LABELS,
} from '../../apps/playground/src/acl-panel.js';
import { PlaygroundAccessControls } from '../../apps/playground/src/playground-access-controls.js';
import type { InstalledNappletRecord } from '../../apps/playground/src/installed-napplet-catalog.js';
import type { PlaygroundAccessControlHost } from '../../apps/playground/src/playground-access-controls.js';

describe('playground capability maps', () => {
  it('labels every canonical DM capability without enabling a DM policy', () => {
    expect(DEMO_CAPABILITY_LABELS['dm:read']).toBe('DM Read');
    expect(DEMO_CAPABILITY_LABELS['dm:write']).toBe('DM Write');
    expect(DEMO_CAPABILITY_HINTS['dm:read']).toBe('direct-message read access');
    expect(DEMO_CAPABILITY_HINTS['dm:write']).toBe('direct-message write access');
    expect(DEMO_CAPABILITY_LABELS['fs:read']).toBe('Filesystem Read');
    expect(DEMO_CAPABILITY_LABELS['fs:write']).toBe('Filesystem Write');
    expect(DEMO_CAPABILITY_HINTS['fs:read']).toBe('virtual-filesystem read and watch access');
    expect(DEMO_CAPABILITY_HINTS['fs:write']).toBe('virtual-filesystem mutation access');
  });

  it('keeps the shell-host ACL snapshot exhaustive for the Capability union', () => {
    const accessControls = readFileSync(
      new URL('../../apps/playground/src/playground-access-controls.ts', import.meta.url),
      'utf8',
    );

    expect(accessControls).toContain("'dm:read': hasCapability('dm:read')");
    expect(accessControls).toContain("'dm:write': hasCapability('dm:write')");
    expect(accessControls).toContain("'fs:read': hasCapability('fs:read')");
    expect(accessControls).toContain("'fs:write': hasCapability('fs:write')");
  });

  it('recovers installed whole-app blocks without granting an interface or changing capabilities', () => {
    const unblock = vi.fn();
    const persist = vi.fn(() => true);
    const host = {
      getRelay: () => ({ runtime: { aclState: { unblock, persist, grant: vi.fn() } } }),
      getNapplets: () => new Map(),
      registerDemoServiceName: vi.fn(),
    } as unknown as PlaygroundAccessControlHost;
    const access = new PlaygroundAccessControls(host);
    const record = { dTag: 'chat', aggregateHash: 'a'.repeat(64) } as InstalledNappletRecord;
    expect(access.unblockInstalled([record])).toEqual({ count: 1, durable: true });
    expect(unblock).toHaveBeenCalledExactlyOnceWith('', record.dTag, record.aggregateHash);
    expect(persist).toHaveBeenCalledOnce();
    expect(host.getRelay().runtime.aclState.grant).not.toHaveBeenCalled();
  });
});
