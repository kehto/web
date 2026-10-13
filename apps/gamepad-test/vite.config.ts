import { defineConfig } from 'vite';
import { nip5aManifest } from '@napplet/vite-plugin';

export default defineConfig({
  server: { cors: true },
  build: {
    // Vite's module-preload polyfill calls `fetch`; one inlined entry needs no
    // preload graph, and NIP-5D napplet code has no ambient network authority.
    modulePreload: { polyfill: false },
  },
  plugins: [
    // Produce one self-contained `/index.html` for NIP-5D `srcdoc` loading,
    // then content-address it with the NIP-5A tag/hash schema.
    nip5aManifest({
      nappletType: 'gamepad-test',
      description: 'Inspect shell-delivered controller input and verify focus isolation.',
      requires: ['gamepad'],
      optional: ['theme'],
      artifactMode: 'single-file',
    }),
  ],
});
