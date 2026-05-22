import { defineConfig } from 'vite';
import { nip5aManifest } from '@napplet/vite-plugin';

const PLAYGROUND_MANIFEST_PRIVKEY_HEX = '11'.repeat(32);
const SHORT_NUB_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

export interface PlaygroundNappletConfigOptions {
  requires?: readonly string[];
}

function validateRequires(nappletType: string, requires: readonly string[]): string[] {
  return requires.map((name) => {
    if (!SHORT_NUB_NAME_PATTERN.test(name) || name.startsWith('nub-')) {
      throw new Error(
        `${nappletType} manifest requires must use short NUB names, got "${name}"`,
      );
    }
    return name;
  });
}

export function definePlaygroundNappletConfig(
  nappletType: string,
  options: PlaygroundNappletConfigOptions = {},
) {
  process.env.VITE_DEV_PRIVKEY_HEX ??= PLAYGROUND_MANIFEST_PRIVKEY_HEX;
  const requires = validateRequires(nappletType, options.requires ?? []);

  return defineConfig({
    base: './',
    plugins: [
      nip5aManifest({
        nappletType,
        artifactMode: 'single-file',
        requires,
      }),
    ],
    build: {
      outDir: 'dist',
      emptyDirBeforeWrite: true,
    },
  });
}
