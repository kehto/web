/**
 * index.test.ts — Unit tests for the NIP-51 list/set parser.
 *
 * Covers kind classification, metadata vs item-tag separation, set addressing,
 * public-item accessors, and the injected-decryptor private-item path.
 */

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import {
  LIST_KINDS,
  SET_KINDS,
  isListKind,
  isSetKind,
  listKindName,
  parseList,
  getTagValues,
  decryptPrivateItems,
  type Nip44Decryptor,
} from './index.js';

function makeEvent(kind: number, tags: string[][], content = '', pubkey = 'author1'): NostrEvent {
  return {
    id: 'event-' + Math.random().toString(36).slice(2),
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags,
    content,
    sig: 'sig',
  };
}

describe('kind classification', () => {
  it('isListKind / isSetKind cover the canonical tables', () => {
    expect(isListKind(10000)).toBe(true);
    expect(isListKind(30000)).toBe(false);
    expect(isSetKind(30030)).toBe(true);
    expect(isSetKind(10000)).toBe(false);
    expect(isListKind(1)).toBe(false);
    expect(isSetKind(1)).toBe(false);
  });

  it('listKindName resolves both families and undefined for unknown', () => {
    expect(listKindName(10000)).toBe('mute');
    expect(listKindName(10003)).toBe('bookmarks');
    expect(listKindName(30030)).toBe('emoji-sets');
    expect(listKindName(1)).toBeUndefined();
  });

  it('the kind tables are internally consistent with the lookups', () => {
    for (const k of Object.keys(LIST_KINDS)) expect(isListKind(Number(k))).toBe(true);
    for (const k of Object.keys(SET_KINDS)) expect(isSetKind(Number(k))).toBe(true);
  });
});

describe('parseList — standard lists', () => {
  it('parses a mute list, separating item tags from metadata', () => {
    const list = parseList(
      makeEvent(10000, [
        ['p', 'spammer1'],
        ['p', 'spammer2'],
        ['word', 'crypto'],
        ['t', 'nsfw'],
      ]),
    );
    expect(list.family).toBe('list');
    expect(list.type).toBe('mute');
    expect(list.address).toBeUndefined();
    expect(list.identifier).toBe('');
    expect(getTagValues(list.publicItems, 'p')).toEqual(['spammer1', 'spammer2']);
    expect(getTagValues(list.publicItems, 'word')).toEqual(['crypto']);
    expect(getTagValues(list.publicItems, 't')).toEqual(['nsfw']);
  });

  it('parses a bookmark list of events and articles', () => {
    const list = parseList(
      makeEvent(10003, [
        ['e', 'note1'],
        ['a', '30023:author:slug'],
        ['r', 'https://example.com'],
      ]),
    );
    expect(list.type).toBe('bookmarks');
    expect(getTagValues(list.publicItems, 'e')).toEqual(['note1']);
    expect(getTagValues(list.publicItems, 'a')).toEqual(['30023:author:slug']);
    expect(getTagValues(list.publicItems, 'r')).toEqual(['https://example.com']);
  });
});

describe('parseList — sets', () => {
  it('parses a follow set with d/title/image/description and a coordinate address', () => {
    const list = parseList(
      makeEvent(30000, [
        ['d', 'close-friends'],
        ['title', 'Close Friends'],
        ['image', 'https://img.example/x.png'],
        ['description', 'people I trust'],
        ['p', 'friend1'],
        ['p', 'friend2'],
      ]),
    );
    expect(list.family).toBe('set');
    expect(list.type).toBe('follow-sets');
    expect(list.identifier).toBe('close-friends');
    expect(list.address).toBe('30000:author1:close-friends');
    expect(list.title).toBe('Close Friends');
    expect(list.image).toBe('https://img.example/x.png');
    expect(list.description).toBe('people I trust');
    expect(getTagValues(list.publicItems, 'p')).toEqual(['friend1', 'friend2']);
  });

  it('parses an emoji set (emoji tags are item tags, not metadata)', () => {
    const list = parseList(
      makeEvent(30030, [
        ['d', 'gnostr'],
        ['emoji', 'gleeful', 'https://cdn.example/gleeful.png'],
        ['emoji', 'reasonable', 'https://cdn.example/reasonable.png'],
      ]),
    );
    expect(list.type).toBe('emoji-sets');
    expect(list.publicItems.filter((t) => t[0] === 'emoji')).toHaveLength(2);
    expect(list.publicItems[0]).toEqual(['emoji', 'gleeful', 'https://cdn.example/gleeful.png']);
  });
});

describe('parseList — unknown kinds', () => {
  it('still parses with family "unknown" and undefined type', () => {
    const list = parseList(makeEvent(39999, [['p', 'x'], ['d', 'whatever']]));
    expect(list.family).toBe('unknown');
    expect(list.type).toBeUndefined();
    expect(list.address).toBeUndefined();
    expect(getTagValues(list.publicItems, 'p')).toEqual(['x']);
  });
});

describe('private items (injected decryptor)', () => {
  it('returns privateItems: [] when there is no encrypted content', async () => {
    const list = parseList(makeEvent(10000, [['p', 'public1']]));
    expect(list.encryptedContent).toBeUndefined();
    const decrypt: Nip44Decryptor = () => {
      throw new Error('should not be called');
    };
    const out = await decryptPrivateItems(list, decrypt);
    expect(out.privateItems).toEqual([]);
  });

  it('decrypts and parses a string[][] tag array, without mutating the input', async () => {
    const list = parseList(makeEvent(10000, [['p', 'public1']], 'CIPHERTEXT'));
    expect(list.encryptedContent).toBe('CIPHERTEXT');
    const decrypt: Nip44Decryptor = (content, author) => {
      expect(content).toBe('CIPHERTEXT');
      expect(author).toBe('author1');
      return JSON.stringify([
        ['p', 'secret-mute'],
        ['word', 'hidden'],
      ]);
    };
    const out = await decryptPrivateItems(list, decrypt);
    expect(getTagValues(out.privateItems!, 'p')).toEqual(['secret-mute']);
    expect(getTagValues(out.privateItems!, 'word')).toEqual(['hidden']);
    // input untouched
    expect(list.privateItems).toBeUndefined();
  });

  it('supports async decryptors', async () => {
    const list = parseList(makeEvent(30000, [['d', 's']], 'CT'));
    const decrypt: Nip44Decryptor = async () => JSON.stringify([['p', 'async-secret']]);
    const out = await decryptPrivateItems(list, decrypt);
    expect(getTagValues(out.privateItems!, 'p')).toEqual(['async-secret']);
  });

  it('throws when the plaintext is not a string[][] tag array', async () => {
    const list = parseList(makeEvent(10000, [], 'CT'));
    await expect(decryptPrivateItems(list, () => JSON.stringify({ not: 'an array' }))).rejects.toThrow(/string\[\]\[\]/);
    await expect(decryptPrivateItems(list, () => JSON.stringify([['ok'], [1, 2]]))).rejects.toThrow();
  });
});
