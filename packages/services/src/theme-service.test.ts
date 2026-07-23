/**
 * theme-service.test.ts — Unit tests for the NIP-5D theme NAP service.
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

    it('uses the complete fixed fallback for an incomplete initial theme', () => {
      const service = createThemeService({
        initialTheme: { colors: { background: '#ffffff' } } as Theme,
      });
      const sent: NappletMessage[] = [];

      service.handler.handleMessage(
        WINDOW_ID,
        makeMsg('theme.get', { id: 'corr-incomplete' }),
        (message) => { sent.push(message); },
      );

      expect(sent).toEqual([
        expect.objectContaining({
          type: 'theme.get.result',
          id: 'corr-incomplete',
          theme: { colors: DEFAULT_THEME_COLORS },
        }),
      ]);
      expect(sent[0]).not.toHaveProperty('error');
    });
  });

  describe('publishTheme broadcast', () => {
    it('updates state before invoking onBroadcast once with one matching envelope', () => {
      const broadcasts: ThemeChangedMessage[] = [];
      let service: ReturnType<typeof createThemeService>;
      service = createThemeService({
        onBroadcast: (envelope) => {
          broadcasts.push(envelope);
          expect(service.getCurrentTheme()).toEqual(envelope.theme);
        },
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

    it('replaces an incomplete published theme with the complete fixed fallback', () => {
      const broadcasts: ThemeChangedMessage[] = [];
      const service = createThemeService({
        onBroadcast: (envelope) => { broadcasts.push(envelope); },
      });

      const returned = service.publishTheme({
        colors: { background: '#ffffff', text: '#000000' },
      } as Theme);

      expect(broadcasts).toEqual([returned]);
      expect(returned.theme).toEqual({ colors: DEFAULT_THEME_COLORS });
      expect(service.getCurrentTheme()).toEqual(returned.theme);
    });
  });

  describe('unknown theme action', () => {
    it.each(['theme.doesNotExist', 'theme.subscribe', 'theme.unsubscribe'])('silently ignores %s', (type) => {
      const service = createThemeService();
      const sent: NappletMessage[] = [];
      const send = (msg: NappletMessage): void => { sent.push(msg); };
      const before = service.getCurrentTheme();

      service.handler.handleMessage(
        WINDOW_ID,
        makeMsg(type, { id: 'corr-bogus' }),
        send,
      );

      expect(sent).toEqual([]);
      expect(service.getCurrentTheme()).toEqual(before);
    });
  });

  describe('onWindowDestroyed', () => {
    it('does not throw', () => {
      const service = createThemeService();
      expect(() => service.handler.onWindowDestroyed?.(WINDOW_ID)).not.toThrow();
    });
  });
});
