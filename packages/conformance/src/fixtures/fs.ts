import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

type Envelope = Readonly<Record<string, unknown>> | null;

/**
 * The fixture works inside `/conformance/work`. Virtual roots are
 * runtime-curated, so a target must expose a writable, listable, watchable
 * root at `/conformance`.
 */
const ROOT = '/conformance';
const WORK = `${ROOT}/work`;
const NOTE = `${WORK}/note.txt`;
const MOVED = `${WORK}/moved.txt`;
const EXTERNAL = `${WORK}/external.txt`;
const CHANGE_KINDS = ['created', 'modified', 'deleted', 'moved', 'unknown'];
const FS_ERRORS = ['not-found', 'already-exists', 'not-a-file', 'not-a-directory', 'invalid-path', 'invalid-data', 'permission-denied', 'policy-denied', 'quota-exceeded', 'too-large', 'unsupported', 'conflict', 'cancelled', 'io-error'];
const b64 = (text: string): string => btoa(text);

/** A path that obeys the NAP-FS path model: absolute, `/`-separated, no empty, `.` or `..` segment. */
function validPath(path: unknown): boolean {
  if (typeof path !== 'string' || !path.startsWith('/')) return false;
  if (path === '/') return true;
  return path.slice(1).split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..' && !segment.includes('\\'));
}

const failsWith = (code: string | null, ...successFields: string[]) => (reply: Envelope): SemanticVerdict => {
  const error = reply?.error;
  if (typeof error !== 'string' || !FS_ERRORS.includes(error)) return `error was ${JSON.stringify(error)}, expected an FsError value`;
  if (code !== null && error !== code) return `error was ${JSON.stringify(error)}, expected ${JSON.stringify(code)}`;
  const present = successFields.filter((field) => reply?.[field] !== undefined);
  return present.length ? `an error result also carried ${present.join(', ')}` : null;
};

function pickProblem(reply: Envelope, kind: 'file' | 'directory', exactlyOne: boolean): SemanticVerdict {
  const entries = (reply?.result as { entries?: { path?: unknown; kind?: unknown; name?: unknown; permissions?: unknown }[] } | undefined)?.entries;
  if (!Array.isArray(entries)) return `result.entries was ${JSON.stringify(entries)}`;
  if (exactlyOne ? entries.length !== 1 : entries.length < 1) return `got ${entries.length} entries, expected ${exactlyOne ? 'exactly one' : 'at least one'}`;
  const bad = entries.find((entry) => entry.kind !== kind || !validPath(entry.path) || typeof entry.name !== 'string' || !Array.isArray(entry.permissions));
  return bad ? `entry ${JSON.stringify(bad)} is not a ${kind} with a path-model path, name and permissions` : null;
}

const pick = (type: string, kind: 'file' | 'directory', exactlyOne: boolean, rule: string, options?: Record<string, unknown>): OperationCase => ({
  id: `fs/${type.slice(3)}`, type, ...(options ? { payload: { options } } : {}), semantics: { rule, verify: (reply) => pickProblem(reply, kind, exactlyOne) },
});

const failing = (id: string, type: string, payload: Record<string, unknown>, code: string | null, rule: string, ...successFields: string[]): OperationCase => ({
  id, type, payload, allowError: true, semantics: { rule, verify: failsWith(code, ...successFields) },
});

const fileOps: OperationCase[] = [
  {
    id: 'fs/write', type: 'fs.write', payload: { path: NOTE, data: b64('hello') },
    semantics: { rule: 'A successful write "MUST ... report bytesWritten equal to the decoded data length"', verify: (reply) => ((reply?.result as { bytesWritten?: unknown })?.bytesWritten === 5 ? null : `result was ${JSON.stringify(reply?.result)}`) },
  },
  {
    id: 'fs/write-append', type: 'fs.write', payload: { path: NOTE, data: b64(' world'), options: { mode: 'append' } },
    semantics: { rule: '"append appends to the file": bytesWritten 6 and, when reported, size 11', verify: (reply) => { const result = reply?.result as { bytesWritten?: unknown; size?: unknown } | undefined; return result?.bytesWritten === 6 && (result.size === undefined || result.size === 11) ? null : `result was ${JSON.stringify(result)}`; } },
  },
  failing('fs/write-if-absent-existing', 'fs.write', { path: NOTE, data: b64('x'), options: { ifAbsent: true } }, 'conflict', '"ifAbsent: true requires the path to be absent ... An unmet precondition MUST fail with conflict"', 'result'),
  failing('fs/write-replace-with-offset', 'fs.write', { path: NOTE, data: b64('x'), options: { mode: 'replace', offset: 0 } }, null, '"replace replaces the whole file and MUST NOT carry offset": the write fails', 'result'),
  {
    id: 'fs/stat', type: 'fs.stat', payload: { path: NOTE },
    semantics: { rule: 'stat returns FsMetadata for the path: kind file and, when reported, size 11', verify: (reply) => { const metadata = reply?.metadata as { path?: unknown; kind?: unknown; size?: unknown } | undefined; return metadata?.path === NOTE && metadata.kind === 'file' && (metadata.size === undefined || metadata.size === 11) ? null : `metadata was ${JSON.stringify(metadata)}`; } },
  },
  {
    id: 'fs/read-range', type: 'fs.read', payload: { path: NOTE, options: { offset: 6, length: 5 } },
    semantics: {
      rule: '"Range reads are mandatory": offset 6 length 5 returns "world" as base64 with bytesRead 5, and eof true at the end of the file',
      verify: (reply) => { const result = reply?.result as { data?: unknown; offset?: unknown; bytesRead?: unknown; eof?: unknown } | undefined; return result?.data === b64('world') && result.offset === 6 && result.bytesRead === 5 && result.eof === true ? null : `result was ${JSON.stringify(result)}`; },
    },
  },
];

const directoryOps: OperationCase[] = [
  failing('fs/read-directory', 'fs.read', { path: WORK }, 'not-a-file', '"Reading a directory MUST fail with not-a-file"', 'result'),
  {
    id: 'fs/list', type: 'fs.list', payload: { path: WORK },
    semantics: { rule: 'list "Lists direct children of a visible directory"', verify: (reply) => (Array.isArray(reply?.entries) && reply.entries.some((entry) => (entry as { path?: unknown; name?: unknown; kind?: unknown }).path === NOTE && (entry as { name?: unknown }).name === 'note.txt' && (entry as { kind?: unknown }).kind === 'file') ? null : `entries were ${JSON.stringify(reply?.entries)}`) },
  },
  failing('fs/list-file', 'fs.list', { path: NOTE }, 'not-a-directory', '"Listing a file MUST fail with not-a-directory"', 'entries'),
  failing('fs/stat-dot-dot', 'fs.stat', { path: `${WORK}/../work/note.txt` }, 'invalid-path', '"Runtimes MUST reject . and .." path segments: invalid-path', 'metadata'),
  { id: 'fs/move', type: 'fs.move', payload: { fromPath: NOTE, toPath: MOVED } },
  {
    id: 'fs/stat-moved-source', type: 'fs.stat', payload: { path: NOTE }, allowError: true,
    semantics: { rule: 'After move the source path is gone: stat fails with not-found', verify: failsWith('not-found', 'metadata') },
  },
  failing('fs/remove-non-empty', 'fs.remove', { path: WORK }, 'conflict', '"Removing a non-empty directory without recursive: true MUST fail with conflict"'),
  { id: 'fs/remove', type: 'fs.remove', payload: { path: MOVED } },
];

/**
 * NAP-FS at napplet/naps#88 head: discovery, every picker (resolved without
 * UI), the file and directory operations with their specified failures, and a
 * watch delivering fs.changed.
 */
export const FS_FIXTURE: DomainFixture = {
  domain: 'fs',
  cases: [
    {
      id: 'fs/info', type: 'fs.info',
      semantics: {
        rule: 'info returns visible roots (path, name, permissions) and limits with non-negative maxReadBytes and maxWriteBytes',
        verify(reply) {
          const info = reply?.info as { roots?: { path?: unknown; name?: unknown; permissions?: unknown }[]; limits?: { maxReadBytes?: unknown; maxWriteBytes?: unknown } } | undefined;
          if (!Array.isArray(info?.roots) || info.roots.some((root) => !validPath(root.path) || typeof root.name !== 'string' || !Array.isArray(root.permissions))) return `roots were ${JSON.stringify(info?.roots)}`;
          const limit = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 0;
          return limit(info.limits?.maxReadBytes) && limit(info.limits?.maxWriteBytes) ? null : `limits were ${JSON.stringify(info.limits)}`;
        },
      },
    },
    pick('fs.pickFile', 'file', true, '"A successful pickFile result MUST contain exactly one file entry" at a path-model virtual path'),
    pick('fs.pickFiles', 'file', false, '"A successful result MUST contain at least one file entry"'),
    pick('fs.pickDirectory', 'directory', true, '"A successful result MUST contain exactly one directory entry"'),
    pick('fs.pickSaveFile', 'file', true, 'pickSaveFile: "A successful result MUST contain exactly one file entry"', { suggestedName: 'saved.txt' }),
    { id: 'fs/mkdir', type: 'fs.mkdir', payload: { path: WORK } },
    failing('fs/mkdir-missing-parent', 'fs.mkdir', { path: `${WORK}/a/b` }, null, '"If recursive is absent or false, the parent directory MUST already exist": the mkdir fails'),
    ...fileOps,
    ...directoryOps,
    // "Unknown watchId values MAY be treated as successful no-ops": an error result is equally valid.
    { id: 'fs/unwatch-unknown', type: 'fs.unwatch', payload: { watchId: 'fs-conformance-unknown-watch' }, allowError: true },
  ],
  pushes: [
    {
      id: 'fs/changed', type: 'fs.changed',
      subscribe: { id: 'fs/watch', type: 'fs.watch', payload: { path: WORK }, semantics: { rule: 'watch returns a watchId', verify: (reply) => (typeof reply?.watchId === 'string' && reply.watchId ? null : `watchId was ${JSON.stringify(reply?.watchId)}`) } },
      trigger: { control: 'fs.externalWrite', payload: { path: EXTERNAL, text: 'external' } },
      then: [{ id: 'fs/read-after-change', type: 'fs.read', payload: { path: EXTERNAL } }],
      semantics: {
        rule: 'fs.changed carries a FsChange (watchId, path-model path of the direct child, a FsChangeKind); a read after the signal returns the new bytes',
        verify(push, replies) {
          const change = push?.change as { watchId?: unknown; path?: unknown; kind?: unknown } | undefined;
          if (typeof change?.watchId !== 'string' || change.path !== EXTERNAL || !CHANGE_KINDS.includes(String(change.kind))) return `change was ${JSON.stringify(change)}`;
          const data = (replies['fs/read-after-change']?.result as { data?: unknown } | undefined)?.data;
          return data === b64('external') ? null : `read after fs.changed returned ${JSON.stringify(data)}`;
        },
      },
    },
  ],
};
