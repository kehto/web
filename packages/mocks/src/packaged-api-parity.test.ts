import { describe, expect, it } from 'vitest';
import type { BlossomApi, CatalogApi, NavigationApi, SoulseekApi, TorrentApi } from '@napplet/core';

import { MOCK_NAPPLET_BINDINGS } from './napplet-bindings.js';

// `@napplet/core` 0.45 packages the napplet-facing API for five mocked draft
// domains. Each `Record<keyof XApi, true>` fails type-check if the package adds
// or renames a member, so this list cannot drift silently from the contract.
const PACKAGED: Record<string, readonly string[]> = {
  torrent: Object.keys({
    capabilities: true, pickFiles: true, add: true, status: true, jobs: true, files: true, selectFiles: true,
    pause: true, resume: true, remove: true, metadata: true, read: true, exportMetainfo: true, saveFile: true,
    openFile: true, cancel: true, update: true, onState: true, onProgress: true, onError: true,
  } satisfies Record<keyof TorrentApi, true>),
  blossom: Object.keys({
    check: true, get: true, checkUpload: true, upload: true, mirror: true, checkMedia: true, media: true, list: true,
    delete: true, servers: true, addServer: true, removeServer: true, reorderServers: true, parseUri: true, formatUri: true,
  } satisfies Record<keyof BlossomApi, true>),
  catalog: Object.keys({ get: true } satisfies Record<keyof CatalogApi, true>),
  navigation: Object.keys({ report: true, get: true } satisfies Record<keyof NavigationApi, true>),
  soulseek: Object.keys({
    info: true, search: true, browse: true, results: true, stop: true, download: true, transfers: true, status: true,
    pause: true, resume: true, cancel: true, read: true, save: true, release: true,
  } satisfies Record<keyof SoulseekApi, true>),
};

describe('bindings match the packaged @napplet/core API', () => {
  it.each(Object.entries(PACKAGED))('%s binds every packaged member or lists it as a gap', (domain, members) => {
    const binding = MOCK_NAPPLET_BINDINGS[domain]!;
    const gaps = binding.gaps.map((gap) => gap.split(':')[0]);
    const bound = [...Object.keys(binding.methods), ...Object.keys(binding.handlers ?? {})];
    expect([...bound, ...gaps].sort()).toEqual([...members].sort());
  });
});
