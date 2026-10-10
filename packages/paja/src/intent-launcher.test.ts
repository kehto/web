import { describe, expect, it } from 'vitest';

import { resolvePajaIntentLauncher } from './intent-launcher.js';

describe('Paja intent launcher', () => {
  it('verifies a signed self-contained artifact without a private signing key', async () => {
    const launcher = await resolvePajaIntentLauncher();

    expect(launcher.manifest.catalogId).toMatch(/^nip5d:35129:/);
    expect(launcher.manifest.requires).toEqual(['intent']);
    expect(launcher.indexHtml).toContain('paja.intent.launch');
    expect(launcher.indexHtml).not.toContain('Uint8Array(32)');
  });
});
