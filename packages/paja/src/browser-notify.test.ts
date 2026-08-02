import type { NotifyInteractionMessage } from '@kehto/services';
import { describe, expect, it, vi } from 'vitest';
import { createPajaNotifyController } from './browser-notify.js';

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly listeners = new Map<string, Array<() => void>>();
  className = '';
  textContent = '';
  type = '';
  parent: FakeElement | null = null;

  append(...nodes: FakeElement[]): void {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  prepend(node: FakeElement): void {
    node.parent = this;
    this.children.unshift(node);
  }

  remove(): void {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = null;
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) listener();
  }

  find(className: string): FakeElement | null {
    if (this.className === className) return this;
    for (const child of this.children) {
      const match = child.find(className);
      if (match) return match;
    }
    return null;
  }
}

class FakeDocument {
  readonly center = new FakeElement();
  readonly badges = new FakeElement();

  getElementById(id: string): FakeElement | null {
    if (id === 'paja-notification-center') return this.center;
    if (id === 'paja-notification-badges') return this.badges;
    return null;
  }

  createElement(): FakeElement {
    return new FakeElement();
  }
}

describe('createPajaNotifyController', () => {
  it('prompts, renders attributed text, and routes user interactions', async () => {
    const document = new FakeDocument();
    const confirm = vi.fn(async () => true);
    const controller = createPajaNotifyController({
      confirm,
      getIdentity: () => ({ dTag: 'weather', aggregateHash: 'sha256:abc' }),
      isEnabled: () => true,
      document: document as unknown as Document,
    });
    expect(controller).not.toBeNull();
    const service = controller!.serviceOptions;
    const emitted: NotifyInteractionMessage[] = [];

    await service.registerChannel?.('window-1', {
      type: 'notify.channel.register',
      channelId: 'alerts',
      label: 'Alerts',
    });
    await service.present?.({
      windowId: 'window-1',
      notificationId: 'notification-1',
      message: {
        type: 'notify.send',
        id: 'request-1',
        title: '<img src=x onerror=alert(1)>',
        body: 'Wind warning',
        channel: 'alerts',
        actions: [{ id: 'open', label: 'Open' }],
      },
      emit: (message) => emitted.push(message),
    });

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      action: 'notify',
      windowId: 'window-1',
      channel: 'alerts',
    }));
    expect(document.center.children).toHaveLength(1);
    const toast = document.center.children[0];
    expect(toast.find('paja-notification-origin')?.textContent).toBe('weather · window-1');
    expect(toast.find('paja-notification-body')?.children[0].textContent).toBe('<img src=x onerror=alert(1)>');

    toast.find('paja-notification-body')?.click();
    toast.find('paja-notification-action')?.click();
    toast.find('paja-notification-close')?.click();
    expect(emitted).toEqual([
      { type: 'notify.clicked', notificationId: 'notification-1' },
      { type: 'notify.action', notificationId: 'notification-1', actionId: 'open' },
      { type: 'notify.dismissed', notificationId: 'notification-1', reason: 'user' },
    ]);
    expect(document.center.children).toHaveLength(0);
  });

  it('tracks badges and cleans all per-window state', async () => {
    const document = new FakeDocument();
    const controller = createPajaNotifyController({
      confirm: () => true,
      isEnabled: () => true,
      document: document as unknown as Document,
    })!;

    await controller.serviceOptions.setBadge?.('window-1', 8);
    expect(document.badges.children[0].textContent).toBe('window-1: 8');
    await controller.serviceOptions.setBadge?.('window-1', 0);
    expect(document.badges.children).toHaveLength(0);

    await controller.serviceOptions.requestPermission?.('window-1');
    await controller.serviceOptions.present?.({
      windowId: 'window-1',
      notificationId: 'notification-1',
      message: { type: 'notify.send', id: 'request-1', title: 'Ready' },
      emit: () => {},
    });
    await controller.serviceOptions.destroyWindow?.('window-1');
    expect(document.center.children).toHaveLength(0);
  });

  it('fails closed when host policy denies notifications', async () => {
    const document = new FakeDocument();
    const confirm = vi.fn();
    const controller = createPajaNotifyController({
      confirm,
      isEnabled: () => false,
      document: document as unknown as Document,
    })!;

    await expect(controller.serviceOptions.present?.({
      windowId: 'window-1',
      notificationId: 'notification-1',
      message: { type: 'notify.send', id: 'request-1', title: 'Denied' },
      emit: () => {},
    })).rejects.toThrow('permission denied');
    expect(confirm).not.toHaveBeenCalled();
    expect(document.center.children).toHaveLength(0);
  });
});
