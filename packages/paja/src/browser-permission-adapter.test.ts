import { describe, expect, it, vi } from 'vitest';
import { PAJA_PERMISSION_STORAGE_KEY, createPajaPermissionAdapter } from './browser-permission-adapter.js';

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

describe('Paja runtime permission adapter', () => {
  it('routes prompt and exact durable records through the shared UI/runtime boundary', async () => {
    vi.clearAllMocks();
    const browserStorage = storage();
    const controller = createPajaPermissionAdapter({
      mount: {} as HTMLElement, getPermissions: () => undefined, storage: browserStorage,
    });
    expect(controller.adapter.persistence?.load()).toBeNull();
    controller.adapter.persistence?.persist('{"version":1,"grants":[]}');
    expect(browserStorage.getItem(PAJA_PERMISSION_STORAGE_KEY)).toBe('{"version":1,"grants":[]}');
    const prompt = { request: {} } as Parameters<NonNullable<typeof controller.adapter.prompt>>[0];
    expect(await controller.adapter.prompt?.(prompt)).toEqual({ effect: 'allow', lifetime: 'session' });
    expect(ui.prompt).toHaveBeenCalledWith(prompt);
    controller.adapter.onStorageError?.('save-failed');
    expect(ui.reportStorageError).toHaveBeenCalledWith('save-failed');
    controller.destroy();
    expect(ui.destroy).toHaveBeenCalledOnce();
  });

  it('keeps persistent choices unavailable when browser storage cannot be opened', () => {
    vi.clearAllMocks();
    const controller = createPajaPermissionAdapter({
      mount: {} as HTMLElement, getPermissions: () => undefined, storage: null,
    });
    expect(controller.adapter.persistence).toBeUndefined();
    expect(ui.reportStorageError).toHaveBeenCalledWith('storage-unavailable');
  });
});
