/**
 * theme-service.test.ts — Unit tests for the NIP-5D theme NUB service.
 *
 * Covers the 1 napplet->shell request type and the host-driven publishTheme
 * broadcast handle from @napplet/nap/theme:
 *   theme.get                 -> theme.get.result with current theme
 *   publishTheme(theme)       -> synchronously updates current theme and
 *                                 invokes options.onBroadcast with a
 *                                 theme.changed envelope
 *
 * Also covers the ACL-denial envelope shape (service-level assertion only;
 * the real end-to-end ACL gate is exercised in dispatch.test.ts).
 */

import { describe, it, expect } from 'vitest';
import { createThemeService } from './theme-service.js';
import type { NappletMessage } from '@napplet/core';
import type { Theme, ThemeChangedMessage } from '@napplet/nap/theme/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';

const DEFAULT_THEME_COLORS = {
  background: '#0a0a0a',
  text: '#e0e0e0',
  primary: '#7aa2f7',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMsg(type: string, fields: Record<string, unknown> = {}): NappletMessage {
  return { type, ...fields } as NappletMessage;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createThemeService', () => {
  it('returns a ServiceHandler whose descriptor.name === "theme"', () => {
    const service = createThemeService();
    expect(service.handler.descriptor.name).toBe('theme');
    expect(typeof service.handler.descriptor.version).toBe('string');
    expect(service.handler.descriptor.version.length).toBeGreaterThan(0);
  });

  describe('theme.get', () => {
    it('returns theme.get.result with the default theme when no initialTheme is supplied', () => {
      const service = createThemeService();
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handler.handleMessage(
        WINDOW_ID,
        makeMsg('theme.get', { id: 'corr-1' }),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('theme.get.result');
      expect((sent[0] as any).id).toBe('corr-1');

      const theme = (sent[0] as any).theme as Theme;
      expect(theme).toBeDefined();
      expect(theme.colors.background).toBe(DEFAULT_THEME_COLORS.background);
      expect(theme.colors.text).toBe(DEFAULT_THEME_COLORS.text);
      expect(theme.colors.primary).toBe(DEFAULT_THEME_COLORS.primary);
      expect(theme.fonts).toBeUndefined();
      expect(theme.background).toBeUndefined();
      expect(theme.title).toBeUndefined();
    });

    it('honors options.initialTheme', () => {
      const initialTheme: Theme = {
        colors: { background: '#ffffff', text: '#000000', primary: '#ff00ff' },
        title: 'Light',
      };
      const service = createThemeService({ initialTheme });
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handler.handleMessage(
        WINDOW_ID,
        makeMsg('theme.get', { id: 'corr-init' }),
        send,
      );

      expect(sent).toHaveLength(1);
      const theme = (sent[0] as any).theme as Theme;
      expect(theme.title).toBe('Light');
      expect(theme.colors.background).toBe('#ffffff');
      expect(theme.colors.text).toBe('#000000');
      expect(theme.colors.primary).toBe('#ff00ff');
    });
  });

  describe('publishTheme broadcast', () => {
    it('updates internal state and invokes onBroadcast with a theme.changed envelope', () => {
      const broadcasts: ThemeChangedMessage[] = [];
      const service = createThemeService({
        onBroadcast: (envelope) => { broadcasts.push(envelope); },
      });

      const newTheme: Theme = {
        colors: { background: '#111111', text: '#eeeeee', primary: '#00ff00' },
        title: 'Dark',
      };
      const returned = service.publishTheme(newTheme);

      // onBroadcast invoked exactly once with theme.changed envelope
      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0].type).toBe('theme.changed');
      expect(broadcasts[0].theme).toEqual(newTheme);

      // publishTheme returns the same envelope
      expect(returned.type).toBe('theme.changed');
      expect(returned.theme).toEqual(newTheme);

      // Internal state updated: subsequent theme.get returns the new theme
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };
      service.handler.handleMessage(
        WINDOW_ID,
        makeMsg('theme.get', { id: 'corr-after-publish' }),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('theme.get.result');
      expect((sent[0] as any).theme.title).toBe('Dark');
      expect((sent[0] as any).theme.colors.background).toBe('#111111');
    });

    it('getCurrentTheme reflects publishTheme updates', () => {
      const service = createThemeService();
      expect(service.getCurrentTheme().colors.background).toBe(DEFAULT_THEME_COLORS.background);

      const newTheme: Theme = {
        colors: { background: '#222222', text: '#cccccc', primary: '#ff0000' },
      };
      service.publishTheme(newTheme);

      expect(service.getCurrentTheme()).toEqual(newTheme);
    });
  });

  describe('ACL denial envelope shape', () => {
    // NOTE: The real ACL gate lives in @kehto/acl's resolveCapabilitiesNub and
    // runs in the runtime BEFORE the service is invoked. This test asserts the
    // shape of the denial envelope the runtime would emit — it does NOT
    // exercise the real ACL path end-to-end. See dispatch.test.ts for the
    // runtime-level integration test exercising the theme:read gate.
    it('denial envelope has { type: "<request>.error", id, error }', () => {
      const msg = makeMsg('theme.get', { id: 'corr-denied' });
      const denialEnvelope = {
        type: `${msg.type}.error`,
        id: (msg as any).id,
        error: 'capability denied: theme:read',
      };
      expect(denialEnvelope.type).toBe('theme.get.error');
      expect(denialEnvelope.id).toBe('corr-denied');
      expect(typeof denialEnvelope.error).toBe('string');
      expect(denialEnvelope.error).toContain('denied');
    });
  });

  describe('unknown theme action', () => {
    it('returns .error envelope with "Unknown theme method" reason', () => {
      const service = createThemeService();
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };

      service.handler.handleMessage(
        WINDOW_ID,
        makeMsg('theme.doesNotExist', { id: 'corr-bogus' }),
        send,
      );

      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('theme.doesNotExist.error');
      expect((sent[0] as any).id).toBe('corr-bogus');
      expect((sent[0] as any).error).toMatch(/Unknown theme method/i);
    });
  });

  describe('onWindowDestroyed', () => {
    it('does not throw', () => {
      const service = createThemeService();
      expect(() => service.handler.onWindowDestroyed?.(WINDOW_ID)).not.toThrow();
    });
  });
});
