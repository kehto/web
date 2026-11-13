import { describe, expect, it, vi } from 'vitest';
import { PAJA_PERMISSION_STORAGE_KEY, createPajaPermissionAdapter } from './browser-permission-adapter.js';
import { PAJA_PERMISSION_RULES_STORAGE_KEY, createPajaPermissionRuleStore, pajaDefaultPermissionRules } from './browser-permission-rules.js';
import { createPermissionRules, permissionRuleSubject, setPermissionRule } from '@kehto/firewall';
import type { PermissionRequest, PermissionRequirement } from '@kehto/firewall';
import { createBrowserApprovalUi } from '@kehto/shell';

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

const promptMount = {} as HTMLElement;
const mount = { ownerDocument: { body: promptMount } } as unknown as HTMLElement;

describe('Paja runtime permission adapter', () => {
  it('routes prompt and exact durable records through the shared UI/runtime boundary', async () => {
    vi.clearAllMocks();
    const browserStorage = storage();
    const controller = createPajaPermissionAdapter({
      mount, getPermissions: () => undefined, storage: browserStorage,
    });
    expect(createBrowserApprovalUi).toHaveBeenCalledWith(expect.objectContaining({ mount, promptMount }));
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
      mount, getPermissions: () => undefined, storage: null,
    });
    expect(controller.adapter.persistence).toBeUndefined();
    expect(ui.reportStorageError).toHaveBeenCalledWith('storage-unavailable');
  });

  it('hands the shared UI and the runtime the same default rules', () => {
    vi.clearAllMocks();
    const controller = createPajaPermissionAdapter({ mount, getPermissions: () => undefined, storage: storage() });
    expect(createBrowserApprovalUi).toHaveBeenCalledWith(expect.objectContaining({ rules: controller.rules }));
  });

  it('redraws the grant list once after a burst of rule-allowed requests', () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    try {
      const controller = createPajaPermissionAdapter({ mount, getPermissions: () => undefined, storage: storage() });
      const request = { principal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) } } as PermissionRequest;
      const keys: PermissionRequirement = {
        category: 'resource', domain: 'keys', operation: 'keys.registerAction', scope: { kind: 'exact', value: 'keys:chord:Escape' },
      };
      const link: PermissionRequirement = {
        category: 'resource', domain: 'link', operation: 'link.open', scope: { kind: 'exact', value: 'https://example.org/' },
      };
      for (let index = 0; index < 100; index++) expect(controller.adapter.defaultDecision?.(request, [keys])).toBe('allow');
      expect(controller.adapter.defaultDecision?.(request, [link])).toBe('ask');
      expect(ui.refresh).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(ui.refresh).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

describe('Paja default Firewall rules', () => {
  const principal = { kind: 'verified' as const, manifestKey: `nip5d:15129:${'b'.repeat(64)}`, artifactHash: 'a'.repeat(64) };
  const request = { principal, sessionId: 's', requestId: 'r', requirements: [] } as PermissionRequest;
  const access = (domain: string): PermissionRequirement => ({
    category: 'interface', domain, operation: 'access', scope: { kind: 'exact', value: domain },
  });
  const keys: PermissionRequirement = {
    category: 'resource', domain: 'keys', operation: 'keys.registerAction', scope: { kind: 'exact', value: 'keys:chord:Escape' },
  };
  const link: PermissionRequirement = {
    category: 'resource', domain: 'link', operation: 'link.open', scope: { kind: 'exact', value: 'https://example.org/' },
  };

  it('allows interfaces and operations by default but asks before opening a link', () => {
    const rules = createPajaPermissionRuleStore(null);
    expect(rules.decide(request, [access('keys'), access('link'), access('fs')])).toBe('allow');
    expect(rules.decide(request, [access('keys'), keys])).toBe('allow');
    expect(rules.decide(request, [link])).toBe('ask');
    // One scope that must be asked about makes the whole request ask.
    expect(rules.decide(request, [access('link'), link])).toBe('ask');
  });

  it('denies a request when any scope it needs is blocked', () => {
    const rules = createPajaPermissionRuleStore(null);
    rules.set(setPermissionRule(rules.get(), { domain: 'keys' }, 'deny'));
    expect(rules.decide(request, [access('keys'), keys])).toBe('deny');
    expect(rules.decide(request, [link, keys])).toBe('deny');
    expect(rules.decide(request, [access('fs')])).toBe('allow');
  });

  it('applies a rule scoped to one napplet only to that napplet', () => {
    const rules = createPajaPermissionRuleStore(null);
    rules.set(setPermissionRule(rules.get(), { napplet: permissionRuleSubject(principal), operation: 'link.open' }, 'allow'));
    expect(rules.decide(request, [link])).toBe('allow');
    const other = { ...request, principal: { ...principal, manifestKey: `nip5d:15129:${'c'.repeat(64)}` } };
    expect(rules.decide(other, [link])).toBe('ask');
  });

  it('persists edited rules and restores them on the next load', () => {
    const browserStorage = storage();
    const rules = createPajaPermissionRuleStore(browserStorage);
    expect(browserStorage.getItem(PAJA_PERMISSION_RULES_STORAGE_KEY)).toBeNull();
    rules.set(setPermissionRule(rules.get(), {}, 'ask'));
    expect(createPajaPermissionRuleStore(browserStorage).get()).toEqual(
      createPermissionRules({ default: 'ask', operations: { 'link.open': 'ask' } }),
    );
  });

  it('falls back to the shipped defaults when the stored rules are damaged', () => {
    const browserStorage = storage();
    browserStorage.setItem(PAJA_PERMISSION_RULES_STORAGE_KEY, '{"version":1,"default":"allow","domains":{"fs":"sometimes"}}');
    expect(createPajaPermissionRuleStore(browserStorage).get()).toEqual(pajaDefaultPermissionRules());
    const unreadable = { ...storage(), getItem: () => { throw new Error('blocked'); } } as Storage;
    expect(createPajaPermissionRuleStore(unreadable).get()).toEqual(pajaDefaultPermissionRules());
  });

  it('keeps the rules in force when the browser refuses to save a change', () => {
    const refusing = { ...storage(), setItem: () => { throw new Error('quota'); } } as Storage;
    const rules = createPajaPermissionRuleStore(refusing);
    expect(() => rules.set(setPermissionRule(rules.get(), {}, 'deny'))).toThrow('quota');
    expect(rules.get()).toEqual(pajaDefaultPermissionRules());
  });
});
