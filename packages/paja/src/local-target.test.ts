import { describe, expect, it } from 'vitest';
import { computeAggregateHash } from '@kehto/nip/5a';

import {
  createPajaLocalTarget,
  findRelativeAssetReferences,
  isPajaLocalHtmlFile,
  isPajaLocalTarget,
  readNappletIdMeta,
} from './local-target.js';

const SINGLE_FILE = '<!doctype html><html><head><title>Feed</title></head><body><script>1</script></body></html>';

// FIPS 180-2 test vector: sha256("abc").
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('@kehto/paja local index.html targets', () => {
  it('computes the NIP-5A single-path aggregate over the exact file bytes', async () => {
    const vector = await createPajaLocalTarget({ name: 'index.html', text: 'abc' });

    expect(vector.sha256).toBe(ABC_SHA256);
    expect(vector.aggregateHash).toBe(computeAggregateHash([{ path: '/index.html', sha256: ABC_SHA256 }]));
    // The aggregate is sha256("<sha256> /index.html\n"), independent of the helper.
    expect(vector.aggregateHash).toBe(await sha256Hex(`${ABC_SHA256} /index.html\n`));

    const target = await createPajaLocalTarget({ name: 'index.html', text: SINGLE_FILE });
    expect(target.sha256).toBe(await sha256Hex(SINGLE_FILE));
    expect(target).toMatchObject({
      source: 'local',
      fileName: 'index.html',
      dTag: 'local-index',
      indexHtml: SINGLE_FILE,
      relays: [],
      blossomServers: [],
      relativeAssets: [],
    });
    expect(Object.isFrozen(target)).toBe(true);
    expect(isPajaLocalTarget(target)).toBe(true);
  });

  it('hashes File bytes and gives an edited file a new identity', async () => {
    const original = await createPajaLocalTarget(new File([SINGLE_FILE], 'index.html', { type: 'text/html' }));
    const edited = await createPajaLocalTarget(new File([`${SINGLE_FILE}\n`], 'index.html', { type: 'text/html' }));

    expect(original.sha256).toBe(await sha256Hex(SINGLE_FILE));
    expect(edited.aggregateHash).not.toBe(original.aggregateHash);
    expect(edited.dTag).toBe(original.dTag);
  });

  it('takes the dTag from NIP-5D napplet-id metadata, else a slugified file stem', async () => {
    const withMeta = await createPajaLocalTarget({
      name: 'index.html',
      text: `<head><meta content=" feed-viewer " name='napplet-id'></head>${SINGLE_FILE}`,
    });
    const withoutMeta = await createPajaLocalTarget({ name: 'My Napplet (v2).HTML', text: SINGLE_FILE });
    const symbolsOnly = await createPajaLocalTarget({ name: '!!!.htm', text: SINGLE_FILE });

    expect(withMeta.dTag).toBe('feed-viewer');
    expect(withoutMeta.dTag).toBe('local-my-napplet-v2');
    expect(symbolsOnly.dTag).toBe('local-napplet');
    expect(readNappletIdMeta('<meta name="napplet-id" content="   ">')).toBeUndefined();
    expect(readNappletIdMeta('<meta name="description" content="feed">')).toBeUndefined();
  });

  it('rejects non-HTML and empty files', async () => {
    await expect(createPajaLocalTarget({ name: 'main.js', type: 'text/javascript', text: 'alert(1)' }))
      .rejects.toThrow('"main.js" is not an HTML file.');
    await expect(createPajaLocalTarget({ name: 'index.html', text: '  \n' }))
      .rejects.toThrow('"index.html" is empty.');
    await expect(createPajaLocalTarget(new File([], 'index.html', { type: 'text/html' })))
      .rejects.toThrow('is empty');

    expect(isPajaLocalHtmlFile({ name: 'build', type: 'text/html; charset=utf-8' })).toBe(true);
    expect(isPajaLocalHtmlFile({ name: 'index.htm' })).toBe(true);
    expect(isPajaLocalHtmlFile({ name: 'index.html.zip' })).toBe(false);
  });

  it('reports relative assets that srcdoc cannot load', async () => {
    const html = [
      '<script type="module" src="./main.js"></script>',
      '<link rel="stylesheet" href="style.css">',
      '<link rel="icon" href="data:image/png;base64,AAAA">',
      '<img src="https://cdn.example/logo.png">',
      '<img src="//cdn.example/protocol-relative.png">',
      '<a href="./not-an-asset.html">link</a>',
    ].join('');
    const target = await createPajaLocalTarget({ name: 'index.html', text: html });

    expect(target.relativeAssets).toEqual(['./main.js', 'style.css']);
    expect(findRelativeAssetReferences(SINGLE_FILE)).toEqual([]);
  });
});
