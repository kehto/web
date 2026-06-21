import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/cli.ts'],
    format: ['esm'],
    platform: 'node',
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: { 'browser-host': 'src/browser-host.ts' },
    format: ['esm'],
    platform: 'browser',
    bundle: true,
    noExternal: [/@kehto\/.*/, /@napplet\/.*/],
    splitting: false,
    dts: false,
    sourcemap: true,
    clean: false,
  },
]);
