import { defineConfig } from 'tsup';

export default defineConfig({
  // One entry per NIP folder (plus the barrel) so each NIP is independently
  // importable and tree-shakable: `@kehto/nip/66`, `@kehto/nip/<n>`, ...
  // Folder entries preserve their directory under dist (dist/66/index.js, ...).
  entry: [
    'src/index.ts',
    'src/51/index.ts',
    'src/65/index.ts',
    'src/66/index.ts',
    'src/89/index.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
