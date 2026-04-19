/**
 * media-service.test.ts — Unit tests for the media NUB service.
 *
 * Covers the 5 napplet->shell request types from @napplet/nub-media plus
 * unknown-action + ACL-denial envelope shapes (stub-scope, preserved verbatim),
 * plus real navigator.mediaSession integration tests added in Phase 27 Plan 01.
 */

import { describe, it, expect } from 'vitest';
import { createMediaService } from './media-service.js';
import type { NappletMessage } from '@napplet/core';
import type { MediaAction } from '@napplet/nub-media';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-media-1';

/**
 * Compose the runtime-level ACL gate in front of the media service.
 * Mirrors the shape of packages/runtime/src/runtime.ts: when the enforce
 * gate denies, the runtime emits a `<type>.error` envelope and never
 * invokes the service. We reproduce that here so the test asserts the
 * exact envelope the napplet will see.
 */
function dispatchWithEnforcer(
  enforcer: { check: () => { allowed: boolean; reason?: string } },
  service: ReturnType<typeof createMediaService>,
  windowId: string,
  message: NappletMessage,
  send: (msg: NappletMessage) => void,
): void {
  const decision = enforcer.check();
  if (!decision.allowed) {
    const id = (message as NappletMessage & { id?: string }).id ?? '';
    send({
      type: `${message.type}.error`,
      id,
      error: decision.reason ?? 'denied',
    } as NappletMessage);
    return;
  }
  service.handleMessage(windowId, message, send);
}

// Helper: MockMediaSession records every setActionHandler call and lets tests
// invoke the stored handlers directly to simulate OS media-control clicks.
// Mirrors the shape of navigator.mediaSession with enough surface for the service.
function createMockMediaSession() {
  const handlers = new Map<string, ((details?: { action?: string; seekTime?: number }) => void) | null>();
  const setActionHandlerCalls: Array<{ action: string; hadHandler: boolean }> = [];
  const target = {
    metadata: null as { title?: string; artist?: string; album?: string; artwork?: unknown } | null,
    playbackState: 'none' as 'none' | 'playing' | 'paused',
    setActionHandler(action: string, handler: ((details?: { action?: string; seekTime?: number }) => void) | null) {
      handlers.set(action, handler);
      setActionHandlerCalls.push({ action, hadHandler: handler !== null });
    },
  };
  function fire(action: string, details?: { action?: string; seekTime?: number }): void {
    const h = handlers.get(action);
    if (h) h(details);
  }
  return { target, handlers, setActionHandlerCalls, fire };
}

// Helper: minimal Document-like stub that lets the service create/remove the
// silent-audio element without a real DOM. Records appendChild / removeChild.
function createMockDocument() {
  const appended: Array<{ tagName: string; src?: string; removed: boolean }> = [];
  const stubBody = {
    appendChild(el: { tagName: string; src?: string }) {
      const record = { tagName: el.tagName, src: el.src, removed: false };
      appended.push(record);
      (el as unknown as { __record: typeof record }).__record = record;
      return el;
    },
  };
  const doc = {
    body: stubBody,
    createElement: (tag: string): unknown => {
      const el = {
        tagName: tag.toUpperCase(),
        src: '',
        loop: false,
        muted: false,
        style: { display: '' } as { display: string },
        setAttribute: () => {},
        play: () => Promise.resolve(),
        pause: () => {},
        remove(this: { __record?: { removed: boolean } }) {
          if (this.__record) this.__record.removed = true;
        },
      };
      return el;
    },
  } as unknown as Document;
  return { doc, appended };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createMediaService', () => {
  it('returns a ServiceHandler with a media descriptor', () => {
    const service = createMediaService();
    expect(service.descriptor.name).toBe('media');
    expect(typeof service.descriptor.version).toBe('string');
  });

  describe('media.session.create', () => {
    it('emits media.session.create.result with matching sessionId', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.session.create',
          id: 'm1',
          sessionId: 's1',
          metadata: { title: 't' },
        } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(1);
      expect((sent[0] as any).type).toBe('media.session.create.result');
      expect((sent[0] as any).id).toBe('m1');
      expect((sent[0] as any).sessionId).toBe('s1');
    });

    it('invokes onSessionCreate callback with windowId, sessionId, metadata', () => {
      const calls: Array<{ windowId: string; sessionId: string; metadata: unknown }> = [];
      const service = createMediaService({
        onSessionCreate: (windowId, sessionId, metadata) => {
          calls.push({ windowId, sessionId, metadata });
        },
      });

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.session.create',
          id: 'm2',
          sessionId: 's2',
          metadata: { title: 'song' },
        } as NappletMessage,
        () => {},
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].windowId).toBe(WINDOW_ID);
      expect(calls[0].sessionId).toBe('s2');
      expect(calls[0].metadata).toEqual({ title: 'song' });
    });
  });

  describe('fire-and-forget requests emit zero envelopes', () => {
    it('media.session.update emits nothing', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.session.update',
          sessionId: 's1',
          metadata: { title: 'new-title' },
        } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(0);
    });

    it('media.session.destroy emits nothing', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        { type: 'media.session.destroy', sessionId: 's1' } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(0);
    });

    it('media.state emits nothing (high-frequency state report)', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.state',
          sessionId: 's1',
          status: 'playing',
          position: 42.5,
          duration: 240,
          volume: 0.8,
        } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(0);
    });

    it('media.capabilities emits nothing', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.capabilities',
          sessionId: 's1',
          actions: ['play', 'pause', 'seek', 'volume'],
        } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(0);
    });

    it('invokes onState callback for media.state', () => {
      const states: Array<{ windowId: string; sessionId: string; state: unknown }> = [];
      const service = createMediaService({
        onState: (windowId, sessionId, state) => {
          states.push({ windowId, sessionId, state });
        },
      });

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.state',
          sessionId: 's1',
          status: 'playing',
        } as NappletMessage,
        () => {},
      );

      expect(states).toHaveLength(1);
      expect(states[0].windowId).toBe(WINDOW_ID);
      expect(states[0].sessionId).toBe('s1');
    });
  });

  describe('unknown media action', () => {
    it('emits <type>.error envelope', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        { type: 'media.bogus', id: 'x' } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(1);
      expect((sent[0] as any).type).toBe('media.bogus.error');
      expect((sent[0] as any).id).toBe('x');
      expect((sent[0] as any).error).toMatch(/Unknown media method/);
    });
  });

  describe('ACL denial envelope shape (runtime-composed)', () => {
    it('media.session.create denied by ACL emits media.session.create.error', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];
      const denyingEnforcer = {
        check: () => ({ allowed: false, reason: 'capability_missing: media:control' }),
      };

      dispatchWithEnforcer(
        denyingEnforcer,
        service,
        WINDOW_ID,
        {
          type: 'media.session.create',
          id: 'm-deny',
          sessionId: 's-deny',
        } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(1);
      expect((sent[0] as any).type).toBe('media.session.create.error');
      expect((sent[0] as any).id).toBe('m-deny');
      expect((sent[0] as any).error).toMatch(/capability_missing|denied|media:control/);
    });
  });
});

describe('navigator.mediaSession integration (real mirror path)', () => {
  it('installs setActionHandler for play/pause/nexttrack/previoustrack/seekto on session.create', () => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });

    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 's-1', sessionId: 'sess-1',
      metadata: { title: 'Test Track', artist: 'Test Artist' },
    } as NappletMessage, () => {});

    const installedActions = mock.setActionHandlerCalls.filter((c) => c.hadHandler).map((c) => c.action);
    expect(installedActions).toEqual(expect.arrayContaining(['play', 'pause', 'nexttrack', 'previoustrack', 'seekto']));
    expect(mock.target.metadata).not.toBeNull();
    expect(mock.target.metadata!.title).toBe('Test Track');
    expect(mock.target.metadata!.artist).toBe('Test Artist');
  });

  it('primes silent-audio element on first session.create and removes it on last destroy', () => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });

    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 's1', sessionId: 'a',
    } as NappletMessage, () => {});

    expect(mockDoc.appended).toHaveLength(1);
    expect(mockDoc.appended[0].tagName).toBe('AUDIO');
    expect(mockDoc.appended[0].src).toMatch(/^data:audio\/wav;base64,/);
    expect(mockDoc.appended[0].removed).toBe(false);

    service.handleMessage(WINDOW_ID, {
      type: 'media.session.destroy', sessionId: 'a',
    } as NappletMessage, () => {});

    expect(mockDoc.appended[0].removed).toBe(true);
  });
});

describe('media.command emission on setActionHandler fire (real push path)', () => {
  it('fires media.command with action=play when mock play handler invoked', () => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const sent: NappletMessage[] = [];
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });

    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 's-a', sessionId: 'sess-a',
      metadata: { title: 'A' },
    } as NappletMessage, (m) => sent.push(m));

    // First envelope is media.session.create.result
    expect(sent).toHaveLength(1);
    expect((sent[0] as NappletMessage & { type: string }).type).toBe('media.session.create.result');

    // Simulate OS user clicking the play button -> mock play handler fires -> service emits media.command.
    mock.fire('play');

    expect(sent).toHaveLength(2);
    const cmd = sent[1] as NappletMessage & { type: string; sessionId?: string; action?: string };
    expect(cmd.type).toBe('media.command');
    expect(cmd.sessionId).toBe('sess-a');
    expect(cmd.action).toBe('play');
  });

  it('maps DOM MediaSessionAction names to nub-media MediaAction literals (play, pause, next, prev, seek)', () => {
    const cases: Array<[string, MediaAction]> = [
      ['play', 'play'],
      ['pause', 'pause'],
      ['nexttrack', 'next'],
      ['previoustrack', 'prev'],
      ['seekto', 'seek'],
    ];
    for (const [domAction, nubAction] of cases) {
      const mock = createMockMediaSession();
      const mockDoc = createMockDocument();
      const sent: NappletMessage[] = [];
      const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });
      service.handleMessage(WINDOW_ID, {
        type: 'media.session.create', id: `s-${domAction}`, sessionId: `sess-${domAction}`,
      } as NappletMessage, (m) => sent.push(m));
      sent.length = 0;  // drop the .result envelope
      mock.fire(domAction, domAction === 'seekto' ? { seekTime: 42 } : undefined);
      expect(sent).toHaveLength(1);
      const cmd = sent[0] as NappletMessage & { action?: string; value?: number };
      expect(cmd.action).toBe(nubAction);
      if (nubAction === 'seek') expect(cmd.value).toBe(42);
    }
  });
});

describe('last-active-wins multi-session semantics', () => {
  it('newest session.create becomes the active session (metadata mirror switches)', () => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });

    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 'sA', sessionId: 'A',
      metadata: { title: 'Track A' },
    } as NappletMessage, () => {});
    expect(mock.target.metadata!.title).toBe('Track A');

    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 'sB', sessionId: 'B',
      metadata: { title: 'Track B' },
    } as NappletMessage, () => {});
    expect(mock.target.metadata!.title).toBe('Track B');
  });

  it('media.state for an older session promotes it to active', () => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });

    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 'sA', sessionId: 'A', metadata: { title: 'A' },
    } as NappletMessage, () => {});
    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 'sB', sessionId: 'B', metadata: { title: 'B' },
    } as NappletMessage, () => {});
    // B is active.
    service.handleMessage(WINDOW_ID, {
      type: 'media.state', sessionId: 'A', status: 'playing',
    } as NappletMessage, () => {});
    // A is now active (state report promotes).
    expect(mock.target.metadata!.title).toBe('A');
    expect(mock.target.playbackState).toBe('playing');
  });
});

describe('media.state status -> playbackState mirroring', () => {
  it.each([
    ['playing', 'playing'],
    ['paused', 'paused'],
    ['stopped', 'none'],
    ['buffering', 'paused'],
  ] as const)('status=%s -> playbackState=%s', (status, expected) => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });
    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 's', sessionId: 'x',
    } as NappletMessage, () => {});
    service.handleMessage(WINDOW_ID, {
      type: 'media.state', sessionId: 'x', status,
    } as NappletMessage, () => {});
    expect(mock.target.playbackState).toBe(expected);
  });
});

describe('media.capabilities narrows action handlers', () => {
  it('capabilities=[play,pause] clears nexttrack/previoustrack/seekto handlers', () => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });
    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 's', sessionId: 'x',
    } as NappletMessage, () => {});
    mock.setActionHandlerCalls.length = 0;  // drop the initial install calls
    service.handleMessage(WINDOW_ID, {
      type: 'media.capabilities', sessionId: 'x', actions: ['play', 'pause'],
    } as NappletMessage, () => {});
    const clearedActions = mock.setActionHandlerCalls.filter((c) => !c.hadHandler).map((c) => c.action);
    expect(clearedActions).toEqual(expect.arrayContaining(['nexttrack', 'previoustrack', 'seekto']));
  });
});

describe('media.session.destroy promotes next-active or clears', () => {
  it('destroying the active session promotes the next-most-recent', () => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });
    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 'sA', sessionId: 'A', metadata: { title: 'A' },
    } as NappletMessage, () => {});
    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 'sB', sessionId: 'B', metadata: { title: 'B' },
    } as NappletMessage, () => {});
    // B is active. Destroy B -> A should become active.
    service.handleMessage(WINDOW_ID, {
      type: 'media.session.destroy', sessionId: 'B',
    } as NappletMessage, () => {});
    expect(mock.target.metadata!.title).toBe('A');
  });

  it('destroying the last session clears navigator.mediaSession', () => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });
    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 's', sessionId: 'X', metadata: { title: 'X' },
    } as NappletMessage, () => {});
    service.handleMessage(WINDOW_ID, {
      type: 'media.session.destroy', sessionId: 'X',
    } as NappletMessage, () => {});
    expect(mock.target.metadata).toBeNull();
    expect(mock.target.playbackState).toBe('none');
  });
});

describe('onWindowDestroyed cleans up sessions for that window only', () => {
  it("removes only the destroyed window's sessions + send handle; other windows remain active", () => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const sentA: NappletMessage[] = [];
    const sentB: NappletMessage[] = [];
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });
    service.handleMessage('win-A', {
      type: 'media.session.create', id: 'sA', sessionId: 'A', metadata: { title: 'A' },
    } as NappletMessage, (m) => sentA.push(m));
    service.handleMessage('win-B', {
      type: 'media.session.create', id: 'sB', sessionId: 'B', metadata: { title: 'B' },
    } as NappletMessage, (m) => sentB.push(m));

    service.onWindowDestroyed?.('win-A');

    // Active session should now be B (A was destroyed with its owning window).
    expect(mock.target.metadata!.title).toBe('B');

    // Fire play - should emit to sendB (owning win-B), not sendA.
    sentB.length = 0;
    mock.fire('play');
    expect(sentB.filter((m) => (m as NappletMessage & { type: string }).type === 'media.command')).toHaveLength(1);
    expect(sentA.filter((m) => (m as NappletMessage & { type: string }).type === 'media.command')).toHaveLength(0);
  });
});

describe('destroy() detaches all action handlers + silent-audio element', () => {
  it('clears all 5 handlers on mock and removes silent-audio element from doc', () => {
    const mock = createMockMediaSession();
    const mockDoc = createMockDocument();
    const service = createMediaService({ mediaSessionTarget: mock.target, documentTarget: mockDoc.doc });

    service.handleMessage(WINDOW_ID, {
      type: 'media.session.create', id: 's', sessionId: 'x',
    } as NappletMessage, () => {});

    mock.setActionHandlerCalls.length = 0;
    service.destroy();

    // After destroy: each of the 5 actions had setActionHandler(action, null) called.
    const clearedActions = mock.setActionHandlerCalls.filter((c) => !c.hadHandler).map((c) => c.action);
    for (const action of ['play', 'pause', 'nexttrack', 'previoustrack', 'seekto']) {
      expect(clearedActions).toContain(action);
    }
    // Silent-audio element removed from mock doc.
    expect(mockDoc.appended[0].removed).toBe(true);
    // navigator.mediaSession cleared.
    expect(mock.target.metadata).toBeNull();
  });
});
