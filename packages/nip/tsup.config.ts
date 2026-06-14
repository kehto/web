import { defineConfig } from 'tsup';

export default defineConfig({
  // One entry per NIP subpath (plus the barrel) so each NIP is independently
  // importable and tree-shakable: `@kehto/nip/66`, `@kehto/nip/<n>`, ...
  entry: ['src/index.ts', 'src/66.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
