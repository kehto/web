import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/kehto-target.ts', 'src/mutations.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    // One self-contained module for a real browser page: the engine plus the
    // first-party target with every workspace and protocol dependency inlined.
    entry: { 'browser/conformance': 'src/browser.ts' },
    format: ['esm'],
    platform: 'browser',
    bundle: true,
    noExternal: [/.*/],
    splitting: false,
    dts: false,
    sourcemap: true,
    clean: false,
  },
]);
