import { describe, it, expect } from 'vitest';
import {
  computeAggregateHash,
  pathEntriesFromTags,
  aggregateTagValue,
  verifyAggregate,
  type PathEntry,
} from './index.js';

// NIP-5A "Aggregate Hash" example inputs (5A.md, PR #2287). The spec lists the
// two path inputs but publishes no digest, so the expected value below is
// computed deterministically from the spec algorithm and pinned as the vector.
const VECTOR_ENTRIES: PathEntry[] = [
  { path: '/index.html', sha256: '186ea5fd14e88fd1ac49351759e7ab906fa94892002b60bf7f5a428f28ca1c99' },
  { path: '/favicon.ico', sha256: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' },
];
const VECTOR_AGGREGATE = 'c2ff582b672a4c689c5e1753528f03dd31b95ec1fdcc3d82d25e7d91e8769638';

describe('computeAggregateHash (NIP-5A)', () => {
  it('matches the pinned NIP-5A example vector', () => {
    expect(computeAggregateHash(VECTOR_ENTRIES)).toBe(VECTOR_AGGREGATE);
  });

  it('is independent of input order (lines are sorted before hashing)', () => {
    const reversed = [...VECTOR_ENTRIES].reverse();
    expect(computeAggregateHash(reversed)).toBe(VECTOR_AGGREGATE);
  });

  it('produces lowercase hex', () => {
    expect(computeAggregateHash(VECTOR_ENTRIES)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('pathEntriesFromTags', () => {
  it('extracts ["path", path, sha256] tags only, in order', () => {
    const tags = [
      ['d', 'chat'],
      ['path', '/index.html', 'aa'],
      ['x', 'bb', 'aggregate'],
      ['path', '/app.js', 'cc'],
    ];
    expect(pathEntriesFromTags(tags)).toEqual([
      { path: '/index.html', sha256: 'aa' },
      { path: '/app.js', sha256: 'cc' },
    ]);
  });

  it('ignores malformed path tags (missing hash)', () => {
    expect(pathEntriesFromTags([['path', '/index.html']])).toEqual([]);
  });
});

describe('aggregateTagValue', () => {
  it('reads the ["x", hex, "aggregate"] tag', () => {
    const tags = [['x', 'deadbeef', 'aggregate'], ['x', 'other', 'something']];
    expect(aggregateTagValue(tags)).toBe('deadbeef');
  });

  it('returns undefined when no aggregate x tag is present', () => {
    expect(aggregateTagValue([['x', 'deadbeef', 'notaggregate']])).toBeUndefined();
  });
});

describe('verifyAggregate', () => {
  const tagsFor = (agg: string) => [
    ['path', '/index.html', '186ea5fd14e88fd1ac49351759e7ab906fa94892002b60bf7f5a428f28ca1c99'],
    ['path', '/favicon.ico', 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321'],
    ['x', agg, 'aggregate'],
  ];

  it('accepts a manifest whose x tag matches the recomputed aggregate', () => {
    expect(verifyAggregate(tagsFor(VECTOR_AGGREGATE))).toBe(true);
  });

  it('rejects a manifest whose x tag does not match', () => {
    expect(verifyAggregate(tagsFor('0'.repeat(64)))).toBe(false);
  });

  it('rejects when the aggregate x tag is missing', () => {
    expect(verifyAggregate([['path', '/index.html', 'aa']])).toBe(false);
  });
});
