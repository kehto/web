import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEMO_CAPABILITY_HINTS,
  DEMO_CAPABILITY_LABELS,
} from '../../apps/playground/src/acl-panel.js';

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
});
