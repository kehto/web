#!/usr/bin/env node
// Build the static conformance UI: the self-contained browser bundle from
// @kehto/conformance plus a page that mounts the UI without live re-runs.
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('@kehto/conformance/package.json'));
const bundle = join(packageRoot, 'dist', 'browser', 'conformance.js');
const { renderUiPage } = await import(pathToFileURL(join(packageRoot, 'dist', 'cli.js')).href);
const out = join(here, 'dist');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copyFileSync(bundle, join(out, 'conformance.js'));
copyFileSync(`${bundle}.map`, join(out, 'conformance.js.map'));
writeFileSync(join(out, 'index.html'), renderUiPage(null));
console.log(`[conformance-app] wrote ${out}`);
