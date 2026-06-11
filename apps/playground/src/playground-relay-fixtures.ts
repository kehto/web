import type { NostrEvent } from '@kehto/shell';

const _now = Math.floor(Date.now() / 1000);
const MONITOR_PUBKEY = 'monitor00000000000000000000000000000000000000000000000000000000';

const NIP66_FIXTURES: NostrEvent[] = [
  nip66Fixture('a', -2, [
    ['d', 'wss://relay.fixture-one.test'],
    ['T', 'Indexer'],
    ['k', '10002'],
    ['N', '1'],
    ['N', '11'],
    ['n', 'clearnet'],
  ]),
  nip66Fixture('b', -1, [
    ['d', 'wss://relay.fixture-two.test'],
    ['T', 'RelayIndexer'],
    ['k', '30166'],
    ['N', '44'],
    ['n', 'clearnet'],
  ]),
  nip66Fixture('c', 0, [['d', 'wss://relay.fixture-three.test'], ['N', '9'], ['N', '50'], ['n', 'clearnet']]),
];

function nip66Fixture(idPrefix: string, createdAtOffset: number, tags: string[][]): NostrEvent {
  return {
    id: idPrefix.repeat(64),
    pubkey: MONITOR_PUBKEY,
    kind: 30166,
    content: '',
    created_at: _now + createdAtOffset,
    tags,
    sig: '0'.repeat(128),
  };
}

export function createPlaygroundNip66FixturePool(): {
  subscribe: (
    relays: ReadonlyArray<string>,
    filter: { kinds: [30166]; '#n'?: ReadonlyArray<string> },
    onEvent: (event: NostrEvent) => void,
  ) => () => void;
} {
  let active = true;
  return {
    subscribe(_relays, _filter, onEvent) {
      for (const event of NIP66_FIXTURES) {
        const captured = event;
        queueMicrotask(() => {
          if (active) onEvent(captured);
        });
      }
      return () => { active = false; };
    },
  };
}
