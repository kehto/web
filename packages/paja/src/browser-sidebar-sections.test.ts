import { afterEach, describe, expect, it, vi } from 'vitest';
import { installPajaSidebarSections, PAJA_SIDEBAR_SECTIONS_STORAGE_KEY } from './browser-sidebar-sections.js';

function harness(preference: string | null = null) {
  const interfaces = Object.assign(new EventTarget(), { open: true });
  const messages = Object.assign(new EventTarget(), { open: true });
  const events = Object.assign(new EventTarget(), { open: true });
  const storage = { getItem: vi.fn(() => preference), setItem: vi.fn() };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('document', {
    getElementById: (id: string) => id === 'paja-section-interfaces'
      ? interfaces
      : id === 'paja-section-messages'
        ? messages
        : id === 'paja-section-events'
          ? events
          : null,
  });
  return { interfaces, messages, events, storage };
}
function toggle(section: EventTarget & { open: boolean }) {
  section.open = !section.open;
  section.dispatchEvent(new Event('toggle'));
}
afterEach(() => vi.unstubAllGlobals());

describe('Paja sidebar sections', () => {
  it.each([null, '', '{', 'null', '[]', '42', 'true', '"interfaces"', '{"interfaces":"true"}', '{"unknown":true,"__proto__":{"interfaces":true}}'])('defaults expanded for invalid preferences %s', (value) => {
    const { interfaces, messages, events, storage } = harness(value);
    installPajaSidebarSections();
    expect(interfaces.open).toBe(true);
    expect(messages.open).toBe(true);
    expect(events.open).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('restores only own booleans, preserves absent Pointer and ignores initialization events', () => {
    const { interfaces, messages, events, storage } = harness('{"interfaces":true,"messages":false,"pointer":true,"acl":"bad","events":true,"__proto__":true,"constructor":true}');
    const dispose = installPajaSidebarSections();
    expect(interfaces.open).toBe(false);
    expect(messages.open).toBe(true);
    interfaces.dispatchEvent(new Event('toggle'));
    expect(storage.setItem).not.toHaveBeenCalled();
    toggle(messages);
    expect(storage.setItem).toHaveBeenLastCalledWith(PAJA_SIDEBAR_SECTIONS_STORAGE_KEY, '{"pointer":true,"interfaces":true,"messages":true,"events":true}');
    toggle(interfaces);
    expect(JSON.parse(storage.setItem.mock.lastCall![1])).toEqual({ pointer: true, interfaces: false, messages: true, events: true });
    toggle(events);
    expect(JSON.parse(storage.setItem.mock.lastCall![1])).toEqual({ pointer: true, interfaces: false, messages: true, events: false });
    dispose();
    toggle(interfaces);
    toggle(messages);
    toggle(events);
    expect(storage.setItem).toHaveBeenCalledTimes(3);
  });
  it.each(['getItem', 'setItem'] as const)('keeps native state usable when %s throws', (method) => {
    const { interfaces, storage } = harness();
    storage[method].mockImplementation(() => { throw new Error('storage denied'); });
    installPajaSidebarSections();
    toggle(interfaces);
    expect(interfaces.open).toBe(false);
    toggle(interfaces);
    expect(interfaces.open).toBe(true);
  });
  it('tolerates an inaccessible storage getter', () => {
    const { interfaces } = harness();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
    const dispose = installPajaSidebarSections();
    toggle(interfaces);
    expect(interfaces.open).toBe(false);
    expect(dispose).not.toThrow();
  });
});
