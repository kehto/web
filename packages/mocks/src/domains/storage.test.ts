import { describe, expect, it } from 'vitest';
import { handleStorageNap, type AclStateContainer, type NappletMessage, type SessionRegistry } from '@kehto/runtime';

import {
  STORAGE_MOCK_ENTRY,
  STORAGE_SPEC_REF,
  createMockStatePersistence,
  utf8ByteLength,
} from './storage.js';

const PREFIX = 'napplet-state:feed:abc123:';
const SEED = { [`${PREFIX}theme`]: 'dark', [`${PREFIX}language`]: 'fi', 'napplet-state:other:zzz:theme': 'light' };

function runtimeStubs() {
  const sessionRegistry = {
    getEntryByWindowId: () => ({ dTag: 'feed', aggregateHash: 'abc123', pubkey: '' }),
  } as unknown as SessionRegistry;
  const aclState = { getStateQuota: () => 256 } as unknown as AclStateContainer;
  const sent: NappletMessage[] = [];
  const send = (_windowId: string, message: NappletMessage | unknown[]) => {
    if (!Array.isArray(message)) sent.push(message);
  };
  return { sessionRegistry, aclState, sent, send };
}

describe('createMockStatePersistence', () => {
  it('records the spec ref and adapter registry entry', () => {
    expect(STORAGE_SPEC_REF).toEqual({ nap: 'NAP-STORAGE', status: 'draft', source: 'pr', pr: 3, sha: '4f4cf0ca', path: 'naps/NAP-STORAGE.md' });
    expect(STORAGE_MOCK_ENTRY.kind).toBe('adapter');
    expect(STORAGE_MOCK_ENTRY.create).toBeUndefined();
    expect(STORAGE_MOCK_ENTRY.note).toContain('statePersistence');
  });

  it('gets, sets, removes, and lists keys by prefix', () => {
    const persistence = createMockStatePersistence({ seed: SEED });
    expect(persistence.get(`${PREFIX}theme`)).toBe('dark');
    expect(persistence.get(`${PREFIX}missing`)).toBeNull();
    expect(persistence.set(`${PREFIX}draft`, 'hello')).toBe(true);
    expect(persistence.keys(PREFIX).sort()).toEqual([`${PREFIX}draft`, `${PREFIX}language`, `${PREFIX}theme`]);
    persistence.remove(`${PREFIX}theme`);
    expect(persistence.get(`${PREFIX}theme`)).toBeNull();
    persistence.clear(PREFIX);
    expect(persistence.keys(PREFIX)).toEqual([]);
    expect(persistence.get('napplet-state:other:zzz:theme')).toBe('light');
  });

  it('counts UTF-8 bytes of key + value under a prefix and excludes an exact key', () => {
    const persistence = createMockStatePersistence({ seed: SEED });
    const expected = utf8ByteLength(`${PREFIX}themedark`) + utf8ByteLength(`${PREFIX}languagefi`);
    expect(persistence.calculateBytes(PREFIX)).toBe(expected);
    expect(persistence.calculateBytes(PREFIX, `${PREFIX}theme`)).toBe(utf8ByteLength(`${PREFIX}languagefi`));
    expect(utf8ByteLength('é€😀')).toBe(2 + 3 + 4);
  });

  it('resets to the seed', () => {
    const persistence = createMockStatePersistence({ seed: SEED });
    persistence.set(`${PREFIX}draft`, 'x');
    persistence.remove(`${PREFIX}theme`);
    persistence.mock.reset();
    expect([...persistence.mock.state().entries()]).toEqual(Object.entries(SEED));
  });

  it('serves the NAP-STORAGE wire protocol through the runtime handler', () => {
    const persistence = createMockStatePersistence({ seed: SEED });
    const { sessionRegistry, aclState, sent, send } = runtimeStubs();
    const handle = (message: Record<string, unknown>) =>
      handleStorageNap('w1', message as unknown as NappletMessage, send, sessionRegistry, aclState, persistence);

    handle({ type: 'storage.get', id: 'a1', key: 'theme' });
    handle({ type: 'storage.get', id: 'a2', key: 'missing-key' });
    handle({ type: 'storage.set', id: 'b2', key: 'theme', value: 'light' });
    handle({ type: 'storage.keys', id: 'd4' });
    handle({ type: 'storage.set', id: 'i1', key: 'scroll', value: '42', scope: 'instance' });
    handle({ type: 'storage.keys', id: 'i2', scope: 'instance' });
    handle({ type: 'storage.remove', id: 'c3', key: 'theme' });
    handle({ type: 'storage.set', id: 'q1', key: 'big', value: 'x'.repeat(200) });

    expect(sent[0]).toEqual({ type: 'storage.get.result', id: 'a1', value: 'dark' });
    expect(sent[1]).toEqual({ type: 'storage.get.result', id: 'a2', value: null });
    expect(sent[2]).toMatchObject({ type: 'storage.set.result', id: 'b2' });
    expect(sent[3]).toEqual({ type: 'storage.keys.result', id: 'd4', keys: ['theme', 'language'] });
    expect(persistence.get(`${PREFIX}@i/w1:scroll`)).toBe('42');
    expect(sent[5]).toEqual({ type: 'storage.keys.result', id: 'i2', keys: ['scroll'] });
    expect(sent[6]).toMatchObject({ type: 'storage.remove.result', id: 'c3' });
    expect(persistence.get(`${PREFIX}theme`)).toBeNull();
    expect(sent[7]).toMatchObject({ type: 'storage.set.result', id: 'q1', error: expect.stringContaining('quota exceeded') });
  });
});
