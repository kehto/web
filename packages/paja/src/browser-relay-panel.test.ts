import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPajaRelayEventCounter,
  installPajaEventCounterReset,
  PAJA_EVENT_COUNTER_RESET_ID,
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

/** Minimal host-page button stand-in for the Events reset control. */
function stubResetButtonDom(button: EventTarget | null = new EventTarget()): EventTarget | null {
  vi.stubGlobal('document', {
    getElementById: (id: string) => id === PAJA_EVENT_COUNTER_RESET_ID ? button : null,
  });
  return button;
}

describe('Paja relay receipts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('counts known kinds per relay, ignores malformed events, and aggregates repeats', () => {
    const counter = createPajaRelayEventCounter();

    counter.recordRead('outbox', ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('a', 1), ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('b', 10005), ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('a', 1), ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', { id: 'no-kind' }, ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', null, ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('c', -1), ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('d', 1.5), ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('e', 1), [], 'nip65');
    counter.recordEvent('hint', event('f', 3), ['wss://hint.example', 'wss://other.example']);

    expect(counter.total).toBe(5);
    expect(counter.uniqueEvents).toBe(3);
    expect(counter.snapshot()).toEqual([
      {
        kind: 'nip65',
        label: 'outbox relays (NIP-65)',
        reason: 'outbox',
        origin: 'nip65',
        count: 3,
        authors: [],
        relays: [{
          relayUrl: 'wss://outbox.example',
          count: 3,
          readCount: 1,
          configured: false,
          kinds: [{ kind: 1, count: 2 }, { kind: 10005, count: 1 }],
        }],
      },
      {
        kind: 'scoped',
        label: 'scoped relay',
        reason: 'hint',
        count: 2,
        authors: [],
        relays: [
          {
            relayUrl: 'wss://hint.example',
            count: 1,
            readCount: 0,
            configured: false,
            kinds: [{ kind: 3, count: 1 }],
          },
          {
            relayUrl: 'wss://other.example',
            count: 1,
            readCount: 0,
            configured: false,
            kinds: [{ kind: 3, count: 1 }],
          },
        ],
      },
    ]);
  });

  it('keeps configured relays visible at zero and orders loaded relays first', () => {
    const counter = createPajaRelayEventCounter();

    counter.recordRead('outbox', ['wss://idle.example'], 'fallback');
    counter.recordRead('outbox', ['wss://busy.example'], 'fallback');
    counter.recordEvent('outbox', event('a', 1), ['wss://busy.example'], 'fallback');

    const fallback = counter.snapshot({ fallback: ['wss://idle.example', 'wss://never.example'] })
      .find((box) => box.kind === 'fallback');

    expect(fallback!.kind).toBe('fallback');
    expect(fallback!.label).toBe('fallback relays');
    expect(fallback!.reason).toBe('outbox');
    expect(fallback!.count).toBe(1);
    expect(fallback!.relays.map((relay) => [relay.relayUrl, relay.count, relay.readCount, relay.configured])).toEqual([
      ['wss://busy.example', 1, 1, false],
      ['wss://idle.example', 0, 1, true],
      ['wss://never.example', 0, 0, true],
    ]);
  });

  it('splits one relay across boxes by router origin instead of merging its counts', () => {
    const counter = createPajaRelayEventCounter();
    const relay = 'wss://shared.example';

    counter.recordRead('outbox', [relay], 'hint');
    counter.recordEvent('outbox', event('a', 1), [relay], 'hint');
    counter.recordEvent('outbox', event('b', 1), [relay], 'hint');
    counter.recordRead('outbox', [relay], 'fallback');
    counter.recordEvent('outbox', event('c', 10005), [relay], 'fallback');

    const boxes = counter.snapshot({ fallback: [relay] });

    expect(boxes.map((box) => box.kind)).toEqual(['nip65', 'hint', 'fallback']);
    expect(boxes.map((box) => box.count)).toEqual([0, 2, 1]);
    // The empty author-routed box says why it is empty instead of showing a zero.
    expect(boxes[0]!.relays).toEqual([]);
    expect(boxes[0]!.emptyNote).toBe('no author-routed reads');
    expect(boxes[1]!.relays[0]).toMatchObject({ relayUrl: relay, count: 2, kinds: [{ kind: 1, count: 2 }] });
    expect(boxes[2]!.relays[0]).toMatchObject({
      relayUrl: relay,
      count: 1,
      configured: true,
      kinds: [{ kind: 10005, count: 1 }],
    });
    // Box counts partition the session receipts rather than double counting them.
    expect(boxes.reduce((sum, box) => sum + box.count, 0)).toBe(counter.total);
  });

  it('omits boxes that never applied while the session has no receipts', () => {
    const counter = createPajaRelayEventCounter();

    counter.recordRead('outbox', ['wss://idle.example'], 'fallback');

    expect(counter.snapshot().map((box) => box.kind)).toEqual(['fallback']);
  });

  it('credits an outbox read without a router origin to its own box', () => {
    const counter = createPajaRelayEventCounter();

    counter.recordRead('outbox', ['wss://originless.example']);
    counter.recordEvent('outbox', event('a', 1), ['wss://originless.example']);

    const unattributed = counter.snapshot().find((box) => box.kind === 'unattributed');

    expect(unattributed?.label).toBe('outbox relays (unattributed)');
    expect(unattributed?.count).toBe(1);
    expect(unattributed?.relays[0]).toMatchObject({ relayUrl: 'wss://originless.example', count: 1 });
  });

  it('attributes each author-routed read to the authors it was routed for', () => {
    const counter = createPajaRelayEventCounter();
    const AUTHOR_A = 'a'.repeat(64);
    const AUTHOR_B = 'b'.repeat(64);

    // One read routed for two authors credits each author once, even when the
    // read reaches several of their relays, and even when the first relay
    // repeats an author inside the same observation.
    counter.recordRead('outbox', ['wss://one.example', 'wss://two.example'], 'nip65', [AUTHOR_A, AUTHOR_A, AUTHOR_B]);
    counter.recordRead('outbox', ['wss://one.example'], 'nip65', [AUTHOR_A]);
    counter.recordRead('outbox', ['wss://fallback.example'], 'fallback');
    counter.recordRead('host', ['wss://host.example'], undefined, [AUTHOR_B]);

    const boxes = counter.snapshot();
    const nip65 = boxes.find((box) => box.kind === 'nip65');
    const fallback = boxes.find((box) => box.kind === 'fallback');
    const host = boxes.find((box) => box.kind === 'host');

    expect(nip65?.authors).toEqual([
      { pubkey: AUTHOR_A, count: 2 },
      { pubkey: AUTHOR_B, count: 1 },
    ]);
    // A read with no authors adds no attribution instead of inventing one.
    expect(fallback?.authors).toEqual([]);
    // Paja's own reads name their authors too, so the host pool is attributable.
    expect(host?.authors).toEqual([{ pubkey: AUTHOR_B, count: 1 }]);
  });

  it('renders author chips so an author-routed relay names whose list routed it', () => {
    const { container } = stubEventCountDom();
    const counter = createPajaRelayEventCounter();
    const author = 'abcdef0123456789'.repeat(4);

    counter.recordRead('outbox', ['wss://someone-else.example'], 'nip65', [author]);
    counter.recordRead('outbox', ['wss://someone-else.example'], 'nip65', [author]);
    renderPajaEventKindCounts(counter);

    const box = container.children[0]!;
    const chips = box.children[1]!;
    expect(chips.className).toBe('event-box-authors');
    const chip = chips.children[0]!;
    expect(chip.dataset.authorPubkey).toBe(author);
    expect(chip.dataset.authorReads).toBe('2');
    expect(chip.text()).toBe('abcdef01…6789 · 2');
    expect(chip.title).toBe(`${author} · routed 2 reads into this box`);
  });

  it('renders routing boxes with bars, idle markers, and kind rows', () => {
    const { container, total } = stubEventCountDom();
    const inventory = { fallback: ['wss://idle.example'] };
    let rerender = (): void => {};
    const counter = createPajaRelayEventCounter(() => rerender());
    rerender = () => renderPajaEventKindCounts(counter, inventory);

    renderPajaEventKindCounts(counter, inventory);
    // Configured relays render before they serve anything.
    expect(container.children.map((box) => box.dataset.relayBox)).toEqual(['fallback']);
    const idleBeforeTraffic = container.children[0]!.children[1]!;
    expect(idleBeforeTraffic.dataset.relayUrl).toBe('wss://idle.example');
    expect(idleBeforeTraffic.children[0]!.text()).toContain('unused');
    expect(total.textContent).toBe('0');

    counter.recordRead('outbox', ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('a', 1), ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('b', 1), ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('c', 10005), ['wss://outbox.example'], 'fallback');
    counter.recordEvent('hint', event('d', 3), ['wss://hint.example']);

    const boxes = container.children;
    expect(boxes.map((box) => box.dataset.relayBox)).toEqual(['nip65', 'fallback', 'scoped']);
    expect(boxes.map((box) => box.dataset.relayReason)).toEqual(['outbox', 'outbox', 'hint']);
    expect(boxes[0]!.children[0]!.text()).toBe('outbox relays (NIP-65) 2');
    const outboxRows = boxes[0]!.children.slice(1);
    expect(outboxRows.map((row) => row.dataset.relayUrl)).toEqual(['wss://outbox.example']);
    expect(outboxRows[0]!.dataset.relayCount).toBe('2');
    expect(outboxRows[0]!.children[1]!.children.map((kindRow) => kindRow.text())).toEqual(['1 - 2']);
    // The same relay's fallback receipt is its own box row, not a chip on the above one.
    expect(boxes[1]!.children[0]!.text()).toBe('fallback relays 1');
    const fallbackRows = boxes[1]!.children.slice(1);
    expect(fallbackRows.map((row) => [row.dataset.relayUrl, row.dataset.relayCount])).toEqual([
      ['wss://outbox.example', '1'],
      ['wss://idle.example', '0'],
    ]);
    expect(fallbackRows[1]!.dataset.relayCount).toBe('0');
    expect(fallbackRows[1]!.children[0]!.text()).toContain('unused');
    expect(boxes[2]!.children[1]!.dataset.relayUrl).toBe('wss://hint.example');
    expect(total.textContent).toBe('4');
    expect(total.title).toBe('4 relay receipts · 4 unique events');
  });

  it('merges equivalent relay URLs while preserving the configured display spelling', () => {
    const counter = createPajaRelayEventCounter();
    counter.recordRead('outbox', ['wss://relay.example', 'wss://relay.example/'], 'fallback');
    counter.recordEvent('outbox', event('a', 1), ['wss://relay.example/'], 'fallback');
    counter.recordEvent('outbox', event('a', 1), ['wss://relay.example'], 'fallback');
    const box = counter.snapshot({ fallback: ['wss://relay.example'] })
      .find((candidate) => candidate.kind === 'fallback');
    expect(box!.relays).toEqual([{
      relayUrl: 'wss://relay.example', count: 2, readCount: 1, configured: true,
      kinds: [{ kind: 1, count: 2 }],
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

  it('renders an author-routed box that stayed empty as a note instead of a zero', () => {
    const { container } = stubEventCountDom();
    const counter = createPajaRelayEventCounter();

    counter.recordEvent('hint', event('d', 3), ['wss://hint.example']);
    renderPajaEventKindCounts(counter);

    const [first] = container.children;
    expect(first!.dataset.relayBox).toBe('nip65');
    expect(first!.children).toHaveLength(1);
    expect(first!.children[0]!.text()).toBe('outbox relays (NIP-65) no author-routed reads');
    expect(container.children[1]!.dataset.relayBox).toBe('scoped');
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

  it('resets every counter back to the boot rendering', () => {
    const { container, total } = stubEventCountDom();
    const inventory = { fallback: ['wss://outbox.example'] };
    let counter!: PajaRelayEventCounter;
    counter = createPajaRelayEventCounter(() => renderPajaEventKindCounts(counter, inventory));

    counter.recordRead('outbox', ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('a', 1), ['wss://outbox.example'], 'nip65');
    counter.recordEvent('outbox', event('b', 10005), ['wss://outbox.example'], 'nip65');

    expect(total.textContent).toBe('2');
    const loaded = container.children[0]!.children[1]!;
    expect(loaded.dataset.relayCount).toBe('2');
    expect(loaded.dataset.relayReads).toBe('1');

    counter.reset();

    expect(counter.total).toBe(0);
    expect(counter.uniqueEvents).toBe(0);
    expect(total.textContent).toBe('0');
    expect(total.title).toBe('0 relay receipts · 0 unique events');
    // Configured relays stay visible at zero, exactly as they render at boot.
    expect(counter.snapshot(inventory)).toEqual([{
      kind: 'fallback',
      label: 'fallback relays',
      reason: 'outbox',
      origin: 'fallback',
      count: 0,
      authors: [],
      relays: [{
        relayUrl: 'wss://outbox.example',
        count: 0,
        readCount: 0,
        configured: true,
        kinds: [],
      }],
    }]);
    const idle = container.children[0]!.children[1]!;
    expect(idle.dataset.relayCount).toBe('0');
    expect(idle.dataset.relayReads).toBe('0');
    expect(idle.children[0]!.text()).toContain('unused');
  });

  it('clears the counters from the Events reset button without toggling the section', () => {
    const button = stubResetButtonDom()!;
    const counter = createPajaRelayEventCounter();
    counter.recordRead('hint', ['wss://hint.example']);
    counter.recordEvent('hint', event('a', 3), ['wss://hint.example']);
    expect(counter.total).toBe(1);

    const dispose = installPajaEventCounterReset(counter);
    const click = new Event('click');
    button.dispatchEvent(click);

    // The click is absorbed so the Events summary does not toggle.
    expect(click.cancelBubble).toBe(true);
    expect(counter.total).toBe(0);
    expect(counter.uniqueEvents).toBe(0);

    counter.recordEvent('hint', event('b', 3), ['wss://hint.example']);
    dispose();
    button.dispatchEvent(new Event('click'));
    expect(counter.total).toBe(1);
  });

  it('installs and disposes without a reset button', () => {
    stubResetButtonDom(null);
    const counter = createPajaRelayEventCounter();

    const dispose = installPajaEventCounterReset(counter);

    expect(dispose).not.toThrow();
  });
});
