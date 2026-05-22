import { defineConfig } from 'vite';
import { nip5aManifest } from '@napplet/vite-plugin';

const PLAYGROUND_MANIFEST_PRIVKEY_HEX = '11'.repeat(32);

export function definePlaygroundNappletConfig(nappletType: string) {
  process.env.VITE_DEV_PRIVKEY_HEX ??= PLAYGROUND_MANIFEST_PRIVKEY_HEX;

  return defineConfig({
    base: './',
    plugins: [
      nip5aManifest({
        nappletType,
        artifactMode: 'single-file',
      }),
    ],
    build: {
      outDir: 'dist',
      emptyDirBeforeWrite: true,
    },
  });
}
