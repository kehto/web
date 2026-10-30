import { describe, expect, it } from 'vitest';
import { isSourceLocation, parseSourceMetadata } from './source-metadata.js';

// NIP-5D §Source at dskvr/nips@6e24617cde507c0a87fa170af9ed6b2b46545b2d.
const sha1 = 'a'.repeat(40);
const sha256 = 'b'.repeat(64);
const archive = ['source-archive', 'https://cdn.example.com/napplet-1.0.0.tar.gz', sha256, 'application/gzip'];

describe('isSourceLocation', () => {
  it.each([
    'https://git.example.com/owner/napplet.git',
    'http://git.example.com/owner/napplet.git',
    'ssh://git@git.example.com/owner/napplet.git',
    'git@git.example.com:owner/napplet.git',
    'git.example.com:owner/napplet.git',
    'git://git.example.com/owner/napplet.git',
    'nostr://naddr1qqxnzd3cxqmrzv3exgmr2wfeqgsxu35yyt0mwjjh8pcz4zprhxegz69t4wr9t74vk6zne58wzh0waycrqsqqqa28pjfdhz',
  ])('accepts %s', (location) => {
    expect(isSourceLocation(location)).toBe(true);
  });
  it.each([
    '', ' ', 'file:///home/dev/napplet', '/home/dev/napplet', 'C:\\napplet', 'c:/napplet',
    'nostr://', 'ftp://example.com/napplet.git', 'owner/napplet', 'git@git.example.com',
    'https://git.example.com/owner/napp let.git', 'git@git.example.com:owner/napp let.git',
  ])('rejects %j', (location) => {
    expect(isSourceLocation(location)).toBe(false);
  });
});

describe('parseSourceMetadata', () => {
  it('keeps one well-formed source with its commit pin and archive', () => {
    expect(parseSourceMetadata([
      ['source', 'git@git.example.com:owner/napplet.git'],
      ['source-commit', sha1],
      archive,
    ])).toEqual({
      source: 'git@git.example.com:owner/napplet.git',
      sourceCommit: sha1,
      sourceArchive: { url: archive[1], sha256, mimeType: 'application/gzip' },
    });
    expect(parseSourceMetadata([['source', 'https://git.example.com/owner/napplet.git'], ['source-commit', sha256]]).sourceCommit).toBe(sha256);
  });
  it.each([
    [[['source', 'https://a.example'], ['source', 'https://b.example']]],
    [[['source', 'https://a.example', 'mirror']]],
    [[['source', 'file:///tmp/napplet']]],
    [[['source']]],
  ])('ignores malformed or repeated source tags without failing: %j', (tags) => {
    expect(parseSourceMetadata(tags)).toEqual({});
  });
  it('ignores a source-commit without a usable repository source or with a bad ID', () => {
    expect(parseSourceMetadata([['source-commit', sha1]])).toEqual({});
    expect(parseSourceMetadata([['source', 'file:///tmp/x'], ['source-commit', sha1]])).toEqual({});
    const source = ['source', 'https://git.example.com/owner/napplet.git'];
    for (const commit of [[ 'source-commit', 'abc' ], ['source-commit', sha1.toUpperCase()], ['source-commit', sha1, 'extra'], ['source-commit', 'g'.repeat(40)]]) {
      expect(parseSourceMetadata([source, commit])).toEqual({ source: source[1] });
    }
    expect(parseSourceMetadata([source, ['source-commit', sha1], ['source-commit', sha1]])).toEqual({ source: source[1] });
  });
  it.each([
    ['http://cdn.example.com/a.tar.gz', sha256, 'application/gzip'],
    ['https://user:pw@cdn.example.com/a.tar.gz', sha256, 'application/gzip'],
    ['https://cdn.example.com/a.tar.gz#frag', sha256, 'application/gzip'],
    ['https://cdn.example.com/a.tar.gz', sha256.toUpperCase(), 'application/gzip'],
    ['https://cdn.example.com/a.tar.gz', sha256, 'gzip'],
    ['https://cdn.example.com/a.tar.gz', sha256],
    ['not a url', sha256, 'application/gzip'],
  ])('ignores a malformed source-archive: %j', (...fields) => {
    expect(parseSourceMetadata([['source-archive', ...fields]])).toEqual({});
  });
  it('ignores repeated source-archive tags', () => {
    expect(parseSourceMetadata([archive, archive])).toEqual({});
  });
});
