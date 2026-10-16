import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPajaRelayEventCounter,
  renderPajaEventKindCounts,
  type PajaRelayEventCounter,
} from './browser-relay-panel.js';
class FakeLogElement {
  className = '';
  textContent = '';
  title = '';
  readonly style: Record<string, string> = {};
  readonly dataset: Record<string, string> = {};
  children: FakeLogElement[] = [];

  constructor(readonly tag: string) {}

  append(...nodes: FakeLogElement[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeLogElement[]): void {
    this.children = nodes;
  }

  text(): string {
    return this.children.length === 0 ? this.textContent : this.children.map((child) => child.text()).join(' ');
  }
}

function stubEventCountDom() {
  const container = new FakeLogElement('div');
  const total = new FakeLogElement('span');
  vi.stubGlobal('document', {
    getElementById: (id: string) => id === 'event-kind-counts'
      ? container
      : id === 'event-kind-total'
        ? total
        : null,
    createElement: (tag: string) => new FakeLogElement(tag),
  });
  return { container, total };
}

function event(id: string, kind: number) {
  return { id, kind };
}

describe('Paja relay receipts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('counts known kinds per relay, ignores malformed events, and aggregates repeats', () => {
    const counter = createPajaRelayEventCounter();

    counter.recordRead('outbox', ['wss://outbox.example']);
    counter.recordEvent('outbox', event('a', 1), ['wss://outbox.example']);
    counter.recordEvent('outbox', event('b', 10005), ['wss://outbox.example']);
    counter.recordEvent('outbox', event('a', 1), ['wss://outbox.example']);
    counter.recordEvent('outbox', { id: 'no-kind' }, ['wss://outbox.example']);
    counter.recordEvent('outbox', null, ['wss://outbox.example']);
    counter.recordEvent('outbox', event('c', -1), ['wss://outbox.example']);
    counter.recordEvent('outbox', event('d', 1.5), ['wss://outbox.example']);
    counter.recordEvent('outbox', event('e', 1), []);
    counter.recordEvent('hint', event('f', 3), ['wss://hint.example', 'wss://other.example']);

    expect(counter.total).toBe(5);
    expect(counter.uniqueEvents).toBe(3);
    expect(counter.snapshot()).toEqual([
      {
        reason: 'outbox',
        count: 3,
        relays: [{
          relayUrl: 'wss://outbox.example',
          count: 3,
          readCount: 1,
          configured: false,
          origins: [],
          kinds: [{ kind: 1, count: 2 }, { kind: 10005, count: 1 }],
        }],
      },
      {
        reason: 'hint',
        count: 2,
        relays: [
          {
            relayUrl: 'wss://hint.example',
            count: 1,
            readCount: 0,
            configured: false,
            origins: [],
            kinds: [{ kind: 3, count: 1 }],
          },
          {
            relayUrl: 'wss://other.example',
            count: 1,
            readCount: 0,
            configured: false,
            origins: [],
            kinds: [{ kind: 3, count: 1 }],
          },
        ],
      },
    ]);
  });

  it('keeps configured relays visible at zero and orders loaded relays first', () => {
    const counter = createPajaRelayEventCounter();

    counter.recordRead('outbox', ['wss://idle.example']);
    counter.recordRead('outbox', ['wss://busy.example']);
    counter.recordEvent('outbox', event('a', 1), ['wss://busy.example']);

    const [outbox] = counter.snapshot({ outbox: ['wss://idle.example', 'wss://never.example'] });

    expect(outbox!.reason).toBe('outbox');
    expect(outbox!.count).toBe(1);
    expect(outbox!.relays.map((relay) => [relay.relayUrl, relay.count, relay.readCount, relay.configured])).toEqual([
      ['wss://busy.example', 1, 1, false],
      ['wss://idle.example', 0, 1, true],
      ['wss://never.example', 0, 0, true],
    ]);
  });

  it('renders reason groups with bars, idle markers, and kind rows', () => {
    const { container, total } = stubEventCountDom();
    const inventory = { outbox: ['wss://idle.example'] };
    let rerender = (): void => {};
    const counter = createPajaRelayEventCounter(() => rerender());
    rerender = () => renderPajaEventKindCounts(counter, inventory);

    renderPajaEventKindCounts(counter, inventory);
    // Configured relays render before they serve anything.
    expect(container.children.map((group) => group.dataset.relayReason)).toEqual(['outbox']);
    const idleBeforeTraffic = container.children[0]!.children[1]!;
    expect(idleBeforeTraffic.dataset.relayUrl).toBe('wss://idle.example');
    expect(idleBeforeTraffic.children[0]!.text()).toContain('unused');
    expect(total.textContent).toBe('0');

    counter.recordRead('outbox', ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('a', 1), ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('b', 1), ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('c', 10005), ['wss://outbox.example'], 'fallback');
    counter.recordEvent('hint', event('d', 3), ['wss://hint.example']);

    const groups = container.children;
    expect(groups.map((group) => group.dataset.relayReason)).toEqual(['outbox', 'hint']);
    expect(groups[0]!.children[0]!.text()).toBe('outbox 3');
    const outboxRows = groups[0]!.children.slice(1);
    expect(outboxRows.map((row) => row.dataset.relayUrl)).toEqual(['wss://outbox.example', 'wss://idle.example']);
    expect(outboxRows[0]!.dataset.relayCount).toBe('3');
    expect(outboxRows[0]!.children[1]!.children.map((kindRow) => kindRow.text())).toEqual(['1 - 2', '10005 - 1']);
    expect(outboxRows[1]!.dataset.relayCount).toBe('0');
    expect(outboxRows[1]!.children[0]!.text()).toContain('unused');
    // Routing origins render as chips beside the relay.
    expect(outboxRows[0]!.children[0]!.children
      .filter((child) => child.className === 'event-relay-origin')
      .map((chip) => chip.dataset.relayOrigin)).toEqual(['fallback', 'nip65']);
    expect(groups[1]!.children[1]!.dataset.relayUrl).toBe('wss://hint.example');
    expect(total.textContent).toBe('4');
    expect(total.title).toBe('4 relay receipts · 4 unique events');
  });

  it('merges equivalent relay URLs while preserving the configured display spelling', () => {
    const counter = createPajaRelayEventCounter();
    counter.recordRead('outbox', ['wss://relay.example', 'wss://relay.example/']);
    counter.recordEvent('outbox', event('a', 1), ['wss://relay.example/']);
    counter.recordEvent('outbox', event('a', 1), ['wss://relay.example']);
    const [group] = counter.snapshot({ outbox: ['wss://relay.example'] });
    expect(group!.relays).toEqual([{
      relayUrl: 'wss://relay.example', count: 2, readCount: 1, configured: true,
      origins: [], kinds: [{ kind: 1, count: 2 }],
    }]);
    expect(counter.total).toBe(2);
    expect(counter.uniqueEvents).toBe(1);
  });

  it('renders an empty state when no relay is configured or observed', () => {
    const { container, total } = stubEventCountDom();
    const counter = createPajaRelayEventCounter();

    renderPajaEventKindCounts(counter);

    expect(container.text()).toBe('no relay events yet');
    expect(total.textContent).toBe('');
  });

  it('labels relays Paja read from without a response as silent', () => {
    const { container } = stubEventCountDom();
    const counter = createPajaRelayEventCounter();
    const inventory = { host: ['wss://quiet.example'] };
    const onChange = createPajaRelayEventCounter(() => renderPajaEventKindCounts(onChange, inventory));

    onChange.recordRead('host', ['wss://quiet.example']);
    renderPajaEventKindCounts(onChange, inventory);

    const quiet = container.children[0]!.children[1]!;
    expect(quiet.dataset.relayReads).toBe('1');
    expect(quiet.children[0]!.text()).toContain('silent');
  });
});
