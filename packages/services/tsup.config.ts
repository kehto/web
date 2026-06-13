import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cvm-nostr-transport.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
