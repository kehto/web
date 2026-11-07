import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { encodeBase64, linuxDistroSums, utf8Bytes } from './file-bytes.js';
import { DEFAULT_GIT_IDENTITY, gitObjectId, seedDistroNotesRepo, sha1 } from './git-fixtures.js';
import { GIT_MOCK_ENTRY, GIT_OPERATIONS, GIT_SPEC_REF, createMockGitService } from './git.js';

// Object ids computed with `git` 2.50 for the same bytes (see git-fixtures.ts).
const COMMIT1 = '06502b95ecc3bafcddf5ae6bced91ded3382f688';
const COMMIT2 = '8b49ab8efd36736021fd6eddb68dd81b898e550f';
const TREE2 = '91af3926b6f1313502ae19b9a9046282c7266017';
const NOTES2 = '8ee82f677de0506bfb8b64dd95f2a532f79eb70f';
const README = '64f3b0fdd35286a0a45bf038d017782c5ae97752';
const SUMS = 'b1a6641eadf51998b9424a03b3162a0a692a470d';
const TAG = '7bc29d1370f022dbc39f99f67bda6be5e7d94814';
// The draft's own SHA-1 fixture.
const NAP_ROOT = 'eb7f6a0e5a12e427bec3f9af5fd505fc2efc1fa4';
const NAP_SECOND = '800cea77c0e8f383c0c6fb6c52b16980d634c17c';
const NAP_TREE = 'dc0a29da1d9b3f68dcd56af0e34f8df4fbf8b24f';
const NAP_BLOB = 'e965047ad7c57865823c7d992b1d046ea66edf78';
const IDENTITY_B64 = 'RXhhbXBsZSA8ZXhhbXBsZUBleGFtcGxlLm9yZz4gMCArMDAwMA==';
const ROUTES = ['git.open', 'git.close', 'git.refs', 'git.get', 'git.read', 'git.createCommit', 'git.updateRef', 'git.fetch', 'git.push', 'git.propose'];

const b64 = (text: string): string => encodeBase64(utf8Bytes(text));

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (message: NappletMessage) => { sent.push(message); } };
}

type Service = ReturnType<typeof createMockGitService>;

function call(service: Service, type: string, fields: Record<string, unknown>, windowId = 'w1', id = 'q1'): NappletMessage & Record<string, any> {
  const { sent, send } = sink();
  service.handleMessage(windowId, { type, id, ...fields } as NappletMessage, send);
  return sent[0] as NappletMessage & Record<string, any>;
}

function opened(options: Parameters<typeof createMockGitService>[0] = {}): { service: Service; repository: string } {
  const service = createMockGitService(options);
  return { service, repository: call(service, 'git.open', {}).result.repository };
}

describe('git-fixtures', () => {
  it('hashes objects exactly like git', () => {
    expect(sha1(new Uint8Array(0))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(gitObjectId('blob', utf8Bytes('Hello\n'))).toBe(NAP_BLOB);
    const repo = seedDistroNotesRepo();
    expect(repo.commits).toEqual([COMMIT1, COMMIT2]);
    expect(repo.refs).toEqual(new Map([['refs/heads/main', COMMIT2], ['refs/tags/v0.1', TAG]]));
    expect(repo.store.get(SUMS)?.body).toEqual(utf8Bytes(linuxDistroSums(LINUX_DISTROS)));
    expect(repo.store.get(TAG)?.body.length).toBe(127);
    expect(DEFAULT_GIT_IDENTITY).toBe('Example <example@example.org> 0 +0000');
  });
});

describe('createMockGitService', () => {
  it('records the spec ref, descriptor, routes, and extension capabilities', () => {
    const service = createMockGitService();
    expect(GIT_SPEC_REF).toEqual({ nap: 'NAP-GIT', status: 'draft', source: 'pr', pr: 137, sha: 'a73bf8de', path: 'naps/NAP-GIT.md' });
    expect(service.descriptor).toMatchObject({ name: 'git', version: '1.0.0' });
    expect(service.mock.routes).toEqual(ROUTES);
    expect(Object.keys(service.messageCapabilities!)).toEqual(ROUTES);
    expect(GIT_MOCK_ENTRY).toMatchObject({ domain: 'git', kind: 'extension', spec: GIT_SPEC_REF });
  });

  it('opens repository handles and lists refs sorted by bytes', () => {
    const service = createMockGitService();
    expect(call(service, 'git.open', { source: 'https://git.example.org/distro-notes.git' })).toEqual({
      type: 'git.open.result',
      id: 'q1',
      result: { repository: 'repo-1', objectFormat: 'sha1', operations: [...GIT_OPERATIONS], remotes: [{ remote: 'remote-1', operations: ['fetch', 'push', 'propose'] }] },
    });
    expect(call(service, 'git.open', { source: 'file:///tmp/repo' })).toEqual({ type: 'git.open.result', id: 'q1', error: { code: 'invalid-request', message: 'invalid source' } });
    expect(call(service, 'git.open', { source: 'ftp://x/y' })).toMatchObject({ error: { code: 'unsupported' } });
    expect(call(service, 'git.open', { extra: 1 })).toMatchObject({ error: { code: 'invalid-request', message: 'unknown field extra' } });
    expect(call(service, 'git.refs', { repository: 'repo-1' })).toEqual({ type: 'git.refs.result', id: 'q1', result: { entries: [{ ref: 'refs/heads/main', oid: COMMIT2 }, { ref: 'refs/tags/v0.1', oid: TAG }], next: null } });
    const first = call(service, 'git.refs', { repository: 'repo-1', limit: 1 });
    expect(first.result).toEqual({ entries: [{ ref: 'refs/heads/main', oid: COMMIT2 }], next: 'c2:1' });
    expect(call(service, 'git.refs', { repository: 'repo-1', limit: 1, cursor: 'c2:1' }).result).toEqual({ entries: [{ ref: 'refs/tags/v0.1', oid: TAG }], next: null });
    expect(call(service, 'git.refs', { repository: 'repo-1', cursor: 'c2:1' })).toMatchObject({ error: { code: 'invalid-cursor' } });
    expect(call(service, 'git.refs', { repository: 'repo-1', limit: 0 })).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.refs', { repository: 'repo-1' }, 'w2')).toEqual({ type: 'git.refs.result', id: 'q1', error: { code: 'invalid-handle' } });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'git.refs', repository: 'repo-1' } as NappletMessage, send);
    expect(sent).toEqual([]);
  });

  it('returns structured objects for commits, trees, tags, and blobs', () => {
    const { service, repository } = opened();
    expect(call(service, 'git.get', { repository, oid: COMMIT2 })).toEqual({
      type: 'git.get.result',
      id: 'q1',
      result: { oid: COMMIT2, kind: 'commit', size: 203, commit: { tree: TREE2, parents: [COMMIT1], author: IDENTITY_B64, committer: IDENTITY_B64, message: b64('Add SHA256SUMS\n') } },
    });
    expect(call(service, 'git.get', { repository, oid: TREE2 })).toEqual({
      type: 'git.get.result',
      id: 'q1',
      result: { oid: TREE2, kind: 'tree', size: 107, entries: [{ name: b64('README.md'), mode: '100644', oid: README }, { name: b64('SHA256SUMS'), mode: '100644', oid: SUMS }, { name: b64('notes'), mode: '040000', oid: NOTES2 }], next: null },
    });
    const page = call(service, 'git.get', { repository, oid: TREE2, limit: 2 });
    expect(page.result.entries).toHaveLength(2);
    expect(call(service, 'git.get', { repository, oid: TREE2, limit: 2, cursor: page.result.next }).result).toMatchObject({ entries: [{ name: b64('notes') }], next: null });
    expect(call(service, 'git.get', { repository, oid: TAG })).toEqual({ type: 'git.get.result', id: 'q1', result: { oid: TAG, kind: 'tag', size: 127, target: COMMIT1 } });
    expect(call(service, 'git.get', { repository, oid: SUMS })).toEqual({ type: 'git.get.result', id: 'q1', result: { oid: SUMS, kind: 'blob', size: 816 } });
    expect(call(service, 'git.get', { repository, oid: SUMS, limit: 1 })).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.get', { repository, oid: '0'.repeat(40) })).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.get', { repository, oid: 'f'.repeat(40) })).toEqual({ type: 'git.get.result', id: 'q1', error: { code: 'not-found' } });
  });

  it('reads exact byte ranges of object bodies', () => {
    const { service, repository } = opened();
    const sums = linuxDistroSums(LINUX_DISTROS);
    expect(call(service, 'git.read', { repository, oid: SUMS, offset: 0, length: 66 })).toEqual({ type: 'git.read.result', id: 'q1', result: { data: b64(sums.slice(0, 66)), offset: 0, size: 816, eof: false } });
    expect(call(service, 'git.read', { repository, oid: SUMS, offset: 800, length: 100 }).result).toEqual({ data: b64(sums.slice(800)), offset: 800, size: 816, eof: true });
    expect(call(service, 'git.read', { repository, oid: SUMS, offset: 900, length: 1 }).result).toEqual({ data: '', offset: 900, size: 816, eof: true });
    expect(call(service, 'git.read', { repository, oid: TAG, offset: 0, length: 6 }).result.data).toBe(b64('object'));
    expect(call(service, 'git.read', { repository, oid: SUMS, offset: -1, length: 20 })).toEqual({ type: 'git.read.result', id: 'q1', error: { code: 'invalid-request', message: 'offset and length must be non-negative integers' } });
    expect(call(service, 'git.read', { repository, oid: SUMS, offset: 0, length: 2_000_000 })).toMatchObject({ error: { code: 'too-large' } });
  });

  it('reproduces the draft SHA-1 fixture through createCommit and updateRef', () => {
    const { service, repository } = opened();
    expect(call(service, 'git.createCommit', { repository, request: { parent: null, changes: [{ path: b64('README.md'), action: 'put', mode: '100644', data: b64('Hi\n') }], message: 'Initial\n' } })).toEqual({ type: 'git.createCommit.result', id: 'q1', result: { oid: NAP_ROOT } });
    expect(call(service, 'git.createCommit', { repository, request: { parent: NAP_ROOT, changes: [{ path: 'UkVBRE1FLm1k', action: 'put', mode: '100644', data: 'SGVsbG8K' }], message: 'Update README\n' } })).toEqual({ type: 'git.createCommit.result', id: 'q1', result: { oid: NAP_SECOND } });
    expect(call(service, 'git.get', { repository, oid: NAP_SECOND }).result.commit).toEqual({ tree: NAP_TREE, parents: [NAP_ROOT], author: IDENTITY_B64, committer: IDENTITY_B64, message: 'VXBkYXRlIFJFQURNRQo=' });
    expect(call(service, 'git.get', { repository, oid: NAP_TREE }).result).toEqual({ oid: NAP_TREE, kind: 'tree', size: 37, entries: [{ name: 'UkVBRE1FLm1k', mode: '100644', oid: NAP_BLOB }], next: null });
    expect(call(service, 'git.read', { repository, oid: NAP_BLOB, offset: 0, length: 6 }).result).toEqual({ data: 'SGVsbG8K', offset: 0, size: 6, eof: true });

    expect(call(service, 'git.updateRef', { repository, request: { ref: 'refs/heads/draft', expected: null, oid: NAP_SECOND } })).toEqual({ type: 'git.updateRef.result', id: 'q1', result: { ref: 'refs/heads/draft', expected: null, oid: NAP_SECOND } });
    expect(call(service, 'git.updateRef', { repository, request: { ref: 'refs/heads/draft', expected: null, oid: NAP_SECOND } })).toEqual({ type: 'git.updateRef.result', id: 'q1', error: { code: 'conflict' } });
    expect(call(service, 'git.updateRef', { repository, request: { ref: 'refs/heads/draft', expected: NAP_SECOND, oid: null } }).result).toEqual({ ref: 'refs/heads/draft', expected: NAP_SECOND, oid: null });
    expect(service.mock.state().refs.has('refs/heads/draft')).toBe(false);
    expect(call(service, 'git.updateRef', { repository, request: { ref: 'refs/tags/v2', expected: null, oid: NAP_SECOND } })).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.updateRef', { repository, request: { ref: 'refs/heads/x', expected: null, oid: null } })).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.updateRef', { repository, request: { ref: 'refs/heads/x', expected: null, oid: NAP_TREE } })).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.updateRef', { repository, request: { ref: 'refs/heads/x', expected: null, oid: 'f'.repeat(40) } })).toMatchObject({ error: { code: 'not-found' } });
  });

  it('edits the seeded tree while preserving unchanged entries and validating changes', () => {
    const { service, repository } = opened();
    const created = call(service, 'git.createCommit', { repository, request: { parent: COMMIT2, changes: [{ path: b64('notes/arch.md'), action: 'delete' }, { path: b64('notes/fedora.md'), action: 'put', mode: '100755', data: b64('# Fedora 41\n') }], message: 'Swap notes\n' } });
    const commit = call(service, 'git.get', { repository, oid: created.result.oid }).result.commit;
    expect(commit.parents).toEqual([COMMIT2]);
    const root = call(service, 'git.get', { repository, oid: commit.tree }).result.entries;
    expect(root.map((entry: { name: string }) => entry.name)).toEqual([b64('README.md'), b64('SHA256SUMS'), b64('notes')]);
    expect(root[0].oid).toBe(README);
    const notes = call(service, 'git.get', { repository, oid: root[2].oid }).result.entries;
    expect(notes).toEqual([{ name: b64('debian.md'), mode: '100644', oid: 'fa4715d615b26cb90de64d67e3cd82024b46003b' }, { name: b64('fedora.md'), mode: '100755', oid: gitObjectId('blob', utf8Bytes('# Fedora 41\n')) }]);

    const request = (changes: unknown[]) => ({ repository, request: { parent: COMMIT2, changes, message: 'x\n' } });
    expect(call(service, 'git.createCommit', request([{ path: b64('notes'), action: 'put', mode: '100644', data: '' }]))).toMatchObject({ error: { code: 'conflict' } });
    expect(call(service, 'git.createCommit', request([{ path: b64('README.md/x'), action: 'put', mode: '100644', data: '' }]))).toMatchObject({ error: { code: 'conflict' } });
    expect(call(service, 'git.createCommit', request([{ path: b64('notes/missing.md'), action: 'delete' }]))).toMatchObject({ error: { code: 'not-found' } });
    expect(call(service, 'git.createCommit', request([{ path: b64('.git/config'), action: 'put', mode: '100644', data: '' }]))).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.createCommit', request([{ path: b64('a'), action: 'put', mode: '100644', data: '' }, { path: b64('a/b'), action: 'put', mode: '100644', data: '' }]))).toMatchObject({ error: { code: 'conflict' } });
    expect(call(service, 'git.createCommit', request([{ path: b64('a'), action: 'put', mode: '100644', data: '' }, { path: b64('a'), action: 'delete' }]))).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.createCommit', request([{ path: b64('a'), action: 'put', mode: '100644' }]))).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.createCommit', request([]))).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.createCommit', { repository, request: { parent: COMMIT2, changes: [{ path: b64('a'), action: 'delete' }], message: '' } })).toMatchObject({ error: { code: 'invalid-request' } });
    expect(call(service, 'git.createCommit', { repository, request: { parent: COMMIT2, changes: [], message: 'x', signer: 'me' } })).toMatchObject({ error: { code: 'invalid-request', message: 'unknown request field signer' } });
    expect(call(service, 'git.refs', { repository }).result.entries[0].oid).toBe(COMMIT2);
  });

  it('fetches, pushes fast-forwards, and proposes ranges against the in-memory remote', () => {
    const { service, repository } = opened();
    expect(call(service, 'git.fetch', { repository, remote: 'remote-1', ref: 'refs/heads/main' })).toEqual({ type: 'git.fetch.result', id: 'q1', result: { ref: 'refs/heads/main', oid: COMMIT2 } });
    expect(call(service, 'git.fetch', { repository, remote: 'remote-1', ref: 'refs/heads/nope' })).toMatchObject({ error: { code: 'not-found' } });
    expect(call(service, 'git.fetch', { repository, remote: 'remote-9', ref: 'refs/heads/main' })).toMatchObject({ error: { code: 'not-found' } });

    const next = call(service, 'git.createCommit', { repository, request: { parent: COMMIT2, changes: [{ path: b64('notes/mint.md'), action: 'put', mode: '100644', data: b64('# Linux Mint 22\n') }], message: 'Add mint\n' } }).result.oid;
    expect(call(service, 'git.push', { repository, request: { remote: 'remote-1', ref: 'refs/heads/main', oid: next } })).toEqual({
      type: 'git.push.result',
      id: 'q1',
      result: { outcome: 'complete', receipts: [{ effect: 'objects', destination: 'remote-1:objects', status: 'accepted', oid: next }, { effect: 'ref', destination: 'remote-1:refs', status: 'accepted', oid: next, ref: 'refs/heads/main' }] },
    });
    expect(call(service, 'git.fetch', { repository, remote: 'remote-1', ref: 'refs/heads/main' }).result.oid).toBe(next);
    expect(call(service, 'git.refs', { repository }).result.entries[0].oid).toBe(COMMIT2);
    expect(call(service, 'git.push', { repository, request: { remote: 'remote-1', ref: 'refs/heads/main', oid: COMMIT1 } })).toEqual({ type: 'git.push.result', id: 'q1', error: { code: 'conflict', message: 'non-fast-forward' } });
    expect(call(service, 'git.push', { repository, request: { remote: 'remote-1', ref: 'refs/heads/topic', oid: COMMIT1 } }).result.outcome).toBe('complete');

    expect(call(service, 'git.propose', { repository, request: { remote: 'remote-1', target: 'refs/heads/main', base: COMMIT1, head: COMMIT2, title: 'Add sums', description: '' } })).toEqual({
      type: 'git.propose.result',
      id: 'q1',
      result: { outcome: 'complete', receipts: [{ effect: 'proposal', destination: 'remote-1:proposals', status: 'accepted', oid: COMMIT2, locator: 'https://forge.example.org/distro-notes/proposals/1' }] },
    });
    expect(service.mock.state().remotes.get('remote-1')?.proposals).toEqual([{ target: 'refs/heads/main', base: COMMIT1, head: COMMIT2, title: 'Add sums', description: '', locator: 'https://forge.example.org/distro-notes/proposals/1' }]);
    expect(call(service, 'git.propose', { repository, request: { remote: 'remote-1', target: 'refs/heads/main', base: COMMIT2, head: COMMIT1, title: 'x', description: '' } })).toMatchObject({ error: { code: 'conflict' } });
    expect(call(service, 'git.propose', { repository, request: { remote: 'remote-1', target: 'refs/heads/main', base: COMMIT1, head: COMMIT2, title: '', description: '' } })).toMatchObject({ error: { code: 'invalid-request' } });

    const denied = opened({ publishPolicy: 'deny' });
    expect(call(denied.service, 'git.push', { repository: denied.repository, request: { remote: 'remote-1', ref: 'refs/heads/main', oid: COMMIT2 } })).toEqual({ type: 'git.push.result', id: 'q1', error: { code: 'denied' } });
    expect(call(denied.service, 'git.propose', { repository: denied.repository, request: { remote: 'remote-1', target: 'refs/heads/main', base: COMMIT1, head: COMMIT2, title: 'x', description: '' } })).toMatchObject({ error: { code: 'denied' } });
  });

  it('closes handles idempotently, invalidates them on window destroy, and resets', () => {
    const { service, repository } = opened();
    expect(call(service, 'git.close', { repository })).toEqual({ type: 'git.close.result', id: 'q1', result: null });
    expect(call(service, 'git.close', { repository })).toEqual({ type: 'git.close.result', id: 'q1', result: null });
    expect(call(service, 'git.read', { repository, oid: README, offset: 0, length: 6 })).toEqual({ type: 'git.read.result', id: 'q1', error: { code: 'invalid-handle' } });
    expect(call(service, 'git.close', { repository }, 'w2')).toMatchObject({ error: { code: 'invalid-handle' } });

    const second = call(service, 'git.open', {}).result.repository;
    expect(second).toBe('repo-2');
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state().handles.size).toBe(0);
    expect(call(service, 'git.refs', { repository: second })).toMatchObject({ error: { code: 'invalid-handle' } });

    call(service, 'git.open', {});
    call(service, 'git.updateRef', { repository: 'repo-3', request: { ref: 'refs/heads/main', expected: COMMIT2, oid: COMMIT1 } });
    service.mock.reset();
    expect(service.mock.state().refs.get('refs/heads/main')).toBe(COMMIT2);
    expect(service.mock.state().handles.size).toBe(0);
    expect(service.mock.state().counters).toEqual({ handle: 0, cursor: 0, proposal: 0 });
    expect(service.mock.sent).toEqual([]);
  });
});
