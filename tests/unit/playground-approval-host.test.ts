import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAYGROUND_PERMISSION_STORAGE_KEY,
  createPlaygroundPermissionAdapter,
} from '../../apps/playground/src/playground-permission-adapter.js';

const ui = vi.hoisted(() => ({
  prompt: vi.fn(async () => ({ effect: 'allow' as const, lifetime: 'session' as const })),
  refresh: vi.fn(), reportStorageError: vi.fn(), destroy: vi.fn(),
}));
vi.mock('@kehto/shell', () => ({ createBrowserApprovalUi: vi.fn(() => ui) }));

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('playground Firewall host adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes prompts, durable records, and storage errors through shared runtime UI', async () => {
    const browserStorage = storage();
    const controller = createPlaygroundPermissionAdapter({
      mount: {} as HTMLElement, getPermissions: () => undefined, storage: browserStorage,
    });
    expect(controller.adapter.persistence?.load()).toBeNull();
    controller.adapter.persistence?.persist('{"version":1,"grants":[]}');
    expect(browserStorage.getItem(PLAYGROUND_PERMISSION_STORAGE_KEY)).toBe('{"version":1,"grants":[]}');
    const prompt = { request: {} } as Parameters<NonNullable<typeof controller.adapter.prompt>>[0];
    expect(await controller.adapter.prompt?.(prompt)).toEqual({ effect: 'allow', lifetime: 'session' });
    expect(ui.prompt).toHaveBeenCalledWith(prompt);
    controller.adapter.onStorageError?.('save-failed');
    expect(ui.reportStorageError).toHaveBeenCalledWith('save-failed');
    controller.destroy();
    expect(ui.destroy).toHaveBeenCalledOnce();
  });

  it('does not offer durable grants when browser storage is unavailable', () => {
    const controller = createPlaygroundPermissionAdapter({
      mount: {} as HTMLElement, getPermissions: () => undefined, storage: null,
    });
    expect(controller.adapter.persistence).toBeUndefined();
    expect(ui.reportStorageError).toHaveBeenCalledWith('storage-unavailable');
  });
});
