import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const read = (path: string): { name: string; version: string } => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as { name: string; version: string };
const own = read('./package.json');
const tested = ['runtime', 'shell', 'nip'].map((name) => read(`../${name}/package.json`));
const napplet = ['@napplet/core', '@napplet/nap'].map((name) => read(`./node_modules/${name}/package.json`));
const define = {
  __KEHTO_CONFORMANCE_VERSION__: JSON.stringify(own.version),
  __KEHTO_CONFORMANCE_PACKAGES__: JSON.stringify(Object.fromEntries([own, ...tested, ...napplet].map((pkg) => [pkg.name, pkg.version]))),
};

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/kehto-target.ts', 'src/mutations.ts', 'src/cli.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    define,
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
    define,
  },
]);
