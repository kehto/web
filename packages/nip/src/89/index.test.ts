/**
 * index.test.ts — Unit tests for the NIP-89 handler-information /
 * recommendation parsers and URL-template expansion.
 */

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import {
  HANDLER_INFORMATION_KIND,
  HANDLER_RECOMMENDATION_KIND,
  parseHandlerInformation,
  handlesKind,
  buildHandlerUrl,
  parseHandlerRecommendation,
} from './index.js';

function makeEvent(kind: number, tags: string[][], content = '', pubkey = 'app-pubkey'): NostrEvent {
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

describe('parseHandlerInformation (kind 31990)', () => {
  it('parses identifier, kinds, metadata, and platform templates', () => {
    const info = parseHandlerInformation(
      makeEvent(
        HANDLER_INFORMATION_KIND,
        [
          ['d', 'my-reader'],
          ['k', '1'],
          ['k', '30023'],
          ['web', 'https://app.example/e/<bech32>', 'nevent'],
          ['web', 'https://app.example/a/<bech32>', 'naddr'],
          ['ios', 'myapp://<raw>'],
        ],
        JSON.stringify({ name: 'My Reader', about: 'reads things' }),
      ),
    );

    expect(info.identifier).toBe('my-reader');
    expect(info.address).toBe('31990:app-pubkey:my-reader');
    expect(info.kinds).toEqual([1, 30023]);
    expect(info.metadata.name).toBe('My Reader');
    expect(info.platforms.web).toEqual([
      { url: 'https://app.example/e/<bech32>', entity: 'nevent' },
      { url: 'https://app.example/a/<bech32>', entity: 'naddr' },
    ]);
    expect(info.platforms.ios).toEqual([{ url: 'myapp://<raw>', entity: undefined }]);
    expect(info.platforms.android).toBeUndefined();
  });

  it('de-duplicates and ignores non-integer k tags', () => {
    const info = parseHandlerInformation(
      makeEvent(HANDLER_INFORMATION_KIND, [['k', '1'], ['k', '1'], ['k', 'notakind'], ['k', '7']]),
    );
    expect(info.kinds).toEqual([1, 7]);
  });

  it('tolerates missing d-tag and invalid JSON content', () => {
    const info = parseHandlerInformation(makeEvent(HANDLER_INFORMATION_KIND, [['k', '1']], 'not json{'));
    expect(info.identifier).toBe('');
    expect(info.address).toBe('31990:app-pubkey:');
    expect(info.metadata).toEqual({});
  });

  it('ignores JSON content that is an array, not an object', () => {
    const info = parseHandlerInformation(makeEvent(HANDLER_INFORMATION_KIND, [], '[1,2,3]'));
    expect(info.metadata).toEqual({});
  });

  it('handlesKind reflects declared kinds', () => {
    const info = parseHandlerInformation(makeEvent(HANDLER_INFORMATION_KIND, [['k', '1'], ['k', '6']]));
    expect(handlesKind(info, 1)).toBe(true);
    expect(handlesKind(info, 6)).toBe(true);
    expect(handlesKind(info, 7)).toBe(false);
  });
});

describe('buildHandlerUrl', () => {
  it('substitutes <bech32>', () => {
    expect(buildHandlerUrl('https://app/e/<bech32>', { bech32: 'nevent1abc' })).toBe('https://app/e/nevent1abc');
  });

  it('substitutes <raw>', () => {
    expect(buildHandlerUrl('myapp://<raw>', { raw: 'deadbeef' })).toBe('myapp://deadbeef');
  });

  it('substitutes both placeholders and all occurrences', () => {
    expect(buildHandlerUrl('x/<bech32>/<raw>/<bech32>', { bech32: 'B', raw: 'R' })).toBe('x/B/R/B');
  });

  it('accepts a HandlerTarget object', () => {
    expect(buildHandlerUrl({ url: 'https://app/<bech32>', entity: 'npub' }, { bech32: 'npub1xyz' })).toBe(
      'https://app/npub1xyz',
    );
  });

  it('returns undefined when a required placeholder value is missing', () => {
    expect(buildHandlerUrl('https://app/<bech32>', { raw: 'r' })).toBeUndefined();
    expect(buildHandlerUrl('myapp://<raw>', { bech32: 'b' })).toBeUndefined();
  });

  it('returns templates without placeholders unchanged', () => {
    expect(buildHandlerUrl('https://app/open', {})).toBe('https://app/open');
  });
});

describe('parseHandlerRecommendation (kind 31989)', () => {
  it('parses recommended kind and a-tag handler endorsements', () => {
    const rec = parseHandlerRecommendation(
      makeEvent(
        HANDLER_RECOMMENDATION_KIND,
        [
          ['d', '1'],
          ['a', '31990:handler-pk:reader', 'wss://relay.example', 'web'],
          ['a', '31990:other-pk:viewer'],
        ],
        '',
        'user-pubkey',
      ),
    );

    expect(rec.pubkey).toBe('user-pubkey');
    expect(rec.recommendedKind).toBe(1);
    expect(rec.recommendations).toEqual([
      {
        address: '31990:handler-pk:reader',
        handlerPubkey: 'handler-pk',
        identifier: 'reader',
        relay: 'wss://relay.example',
        platform: 'web',
      },
      {
        address: '31990:other-pk:viewer',
        handlerPubkey: 'other-pk',
        identifier: 'viewer',
        relay: undefined,
        platform: undefined,
      },
    ]);
  });

  it('ignores a-tags that are not 31990 coordinates', () => {
    const rec = parseHandlerRecommendation(
      makeEvent(HANDLER_RECOMMENDATION_KIND, [
        ['d', '30023'],
        ['a', '30023:someone:article'],
        ['a', '31990:handler:x'],
      ]),
    );
    expect(rec.recommendedKind).toBe(30023);
    expect(rec.recommendations).toHaveLength(1);
    expect(rec.recommendations[0].address).toBe('31990:handler:x');
  });

  it('sets recommendedKind undefined when the d-tag is missing or non-numeric', () => {
    expect(parseHandlerRecommendation(makeEvent(HANDLER_RECOMMENDATION_KIND, [])).recommendedKind).toBeUndefined();
    expect(
      parseHandlerRecommendation(makeEvent(HANDLER_RECOMMENDATION_KIND, [['d', 'notakind']])).recommendedKind,
    ).toBeUndefined();
  });
});
