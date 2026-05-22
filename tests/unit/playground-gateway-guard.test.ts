import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const playgroundNapplets = [
  'bot',
  'chat',
  'composer',
  'config-demo',
  'decrypt-demo',
  'feed',
  'hotkey-chord',
  'media-controller',
  'preferences',
  'profile-viewer',
  'resource-demo',
  'theme-switcher',
  'toaster',
] as const;

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('playground gateway artifact guard', () => {
  it('keeps every playground napplet on the shared single-file build config', () => {
    for (const name of playgroundNapplets) {
      const config = readRepoFile(`apps/playground/napplets/${name}/vite.config.ts`);
      expect(config, `${name} import`).toContain(
        "import { definePlaygroundNappletConfig } from '../shared-vite-config';",
      );
      expect(config, `${name} d tag`).toContain(
        `export default definePlaygroundNappletConfig('${name}');`,
      );
    }

    const sharedConfig = readRepoFile('apps/playground/napplets/shared-vite-config.ts');
    expect(sharedConfig).toContain("artifactMode: 'single-file'");
  });

  it('keeps the active loader on the gateway route with opaque-origin iframes', () => {
    const shellHost = readRepoFile('apps/playground/src/shell-host.ts');

    expect(shellHost).toContain('/napplet-gateway/${encodeURIComponent(name)}/manifest.json');
    expect(shellHost).toContain('iframe.src = metadata.htmlUrl');
    expect(shellHost).toContain("iframe.sandbox.add('allow-scripts')");
    expect(shellHost).not.toContain('allow-same-origin');
    expect(shellHost).not.toContain('`/napplets/${name}/index.html`');
  });
});

