import { describe, expect, it } from 'vitest';

// @ts-expect-error -- plain ESM script without type declarations
import { compareRefs, fetchUpstream, formatReport, loadDeferred, parseSpecRefs } from '../scripts/audit-naps.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = `
export const LINK_SPEC_REF: NapSpecRef = { nap: 'NAP-LINK', status: 'draft', source: 'pr', pr: 53, sha: '50a2cd45e76f', path: 'naps/NAP-LINK.md' };
export const THEME_SPEC_REF: NapSpecRef = Object.freeze({
  nap: 'NAP-THEME',
  status: 'merged',
  source: 'master',
  sha: '43cb3a4e8555',
  path: 'naps/NAP-THEME.md',
});
`;

const UPSTREAM = {
  master: { sha: '43cb3a4e8555aaaaaaaaaaaaaaaaaaaaaaaaaaaa', docs: ['naps/NAP-THEME.md', 'naps/NAP-SHELL.md'] },
  pulls: [
    { number: 53, sha: 'ffffffffffffffffffffffffffffffffffffffff', draft: false, title: 'NAP-LINK: v2', docs: ['naps/NAP-LINK.md', 'naps/NAP-THEME.md'] },
    { number: 99, sha: '1111111111111111111111111111111111111111', draft: true, title: 'NAP-NEW', docs: ['naps/NAP-NEW.md'] },
  ],
};

describe('audit-naps', () => {
  it('parses spec ref literals, including frozen multi-line ones', () => {
    expect(parseSpecRefs(SOURCE)).toEqual([
      { nap: 'NAP-LINK', status: 'draft', source: 'pr', pr: 53, sha: '50a2cd45e76f', path: 'naps/NAP-LINK.md' },
      { nap: 'NAP-THEME', status: 'merged', source: 'master', sha: '43cb3a4e8555', path: 'naps/NAP-THEME.md' },
    ]);
  });

  it('classifies current, stale, retired, and missing documents', () => {
    const refs = [
      ...parseSpecRefs(SOURCE),
      { nap: 'NAP-OLD', status: 'draft', source: 'pr', pr: 7, sha: 'abcd', path: 'naps/NAP-OLD.md' },
      { nap: 'NAP-GONE', status: 'merged', source: 'master', sha: '43cb3a4e', path: 'naps/NAP-GONE.md' },
    ];
    const report = compareRefs(refs, UPSTREAM);
    expect(report.current.map((item: { ref: { nap: string } }) => item.ref.nap)).toEqual(['NAP-THEME']);
    expect(report.stale.map((item: { ref: { nap: string } }) => item.ref.nap)).toEqual(['NAP-LINK']);
    expect(report.retired.map((item: { ref: { nap: string }, reason: string }) => [item.ref.nap, item.reason])).toEqual([
      ['NAP-OLD', 'PR #7 is not open'],
      ['NAP-GONE', 'document no longer on master'],
    ]);
    // Master docs without a ref and new PR docs are missing; PR edits of
    // master docs (NAP-THEME in PR 53) are not reported as new documents.
    expect(report.missing.map((item: { path: string; pr?: number }) => [item.path, item.pr])).toEqual([
      ['naps/NAP-SHELL.md', undefined],
      ['naps/NAP-NEW.md', 99],
    ]);
    const text = formatReport(report);
    expect(text).toContain('stale (1)');
    expect(text).toContain('NAP-NEW.md PR #99 (draft)');
  });

  it('defers an exactly pinned draft, re-flags it when the head moves, and retires stale entries', () => {
    const refs = parseSpecRefs(SOURCE);
    const entry = { nap: 'NAP-NEW', path: 'naps/NAP-NEW.md', pr: 99, sha: '111111111111', reason: 'No Kehto support yet.' };
    const pinned = compareRefs(refs, UPSTREAM, [entry]);
    expect(pinned.deferred.map((item: { path: string; reason: string }) => [item.path, item.reason])).toEqual([['naps/NAP-NEW.md', 'No Kehto support yet.']]);
    expect(pinned.missing.map((item: { path: string }) => item.path)).toEqual(['naps/NAP-SHELL.md']);
    expect(formatReport(pinned)).toContain('deferred (1)');

    const moved = compareRefs(refs, UPSTREAM, [{ ...entry, sha: '222222222222' }]);
    expect(moved.deferred).toEqual([]);
    expect(moved.missing.map((item: { path: string; deferredAt?: string }) => [item.path, item.deferredAt])).toEqual([
      ['naps/NAP-SHELL.md', undefined],
      ['naps/NAP-NEW.md', '222222222222'],
    ]);
    expect(formatReport(moved)).toContain('head moved, re-review');

    // A master document is never deferrable, and entries for closed or already mocked drafts are retired.
    const misuse = compareRefs(refs, UPSTREAM, [
      { ...entry, nap: 'NAP-SHELL', path: 'naps/NAP-SHELL.md' },
      { ...entry, pr: 7 },
      { ...entry, nap: 'NAP-LINK', path: 'naps/NAP-LINK.md', pr: 53, sha: 'ffffffffffff' },
    ]);
    expect(misuse.missing.map((item: { path: string }) => item.path)).toEqual(['naps/NAP-SHELL.md', 'naps/NAP-NEW.md']);
    expect(misuse.retired.map((item: { reason: string }) => item.reason)).toEqual([
      'deferred PR #7 is not open; drop it from deferred-naps.json',
      'deferred document is now mocked; drop it from deferred-naps.json',
    ]);
  });

  it('loads and validates the deferred list', () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-naps-'));
    expect(loadDeferred(join(dir, 'absent.json'))).toEqual([]);
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify([{ nap: 'NAP-X', path: 'naps/NAP-X.md', pr: 1, sha: 'nothex', reason: 'x' }]));
    expect(() => loadDeferred(bad)).toThrow(TypeError);
    const shipped = loadDeferred(join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'deferred-naps.json'));
    expect(shipped.map((item: { nap: string; pr: number }) => [item.nap, item.pr])).toEqual([['NAP-WEBMCP', 150], ['NAP-NEIGHBOR', 146], ['NAP-EMAIL', 139]]);
  });

  it('fetches the upstream inventory through an injected gh executor', () => {
    const calls: string[][] = [];
    const exec = (_cmd: string, args: string[]): string => {
      calls.push(args);
      const key = args.join(' ');
      if (key.includes('commits/master')) return JSON.stringify({ sha: 'abc123' });
      if (key.includes('contents/naps')) return JSON.stringify([{ path: 'naps/NAP-THEME.md' }, { path: 'naps/README.md' }]);
      if (args[0] === 'pr') return JSON.stringify([{ number: 5, headRefOid: 'def456', isDraft: false, title: 'NAP-X' }]);
      if (key.includes('pulls/5/files')) return JSON.stringify([{ filename: 'naps/NAP-X.md', status: 'added' }, { filename: 'naps/NAP-Y.md', status: 'removed' }]);
      throw new Error(`unexpected gh call: ${key}`);
    };
    const upstream = fetchUpstream({ exec });
    expect(upstream).toEqual({
      master: { sha: 'abc123', docs: ['naps/NAP-THEME.md'] },
      pulls: [{ number: 5, sha: 'def456', draft: false, title: 'NAP-X', docs: ['naps/NAP-X.md'] }],
    });
    expect(calls.every((args) => args[0] === 'api' || args[0] === 'pr')).toBe(true);
  });
});
