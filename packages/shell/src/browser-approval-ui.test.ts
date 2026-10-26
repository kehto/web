import { describe, expect, it, vi } from 'vitest';
import type { ApprovalPrompt, PermissionGrant, RuntimePermissions } from '@kehto/runtime';
import { createBrowserApprovalUi } from './browser-approval-ui.js';

class TestElement extends EventTarget {
  readonly children: TestElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly ownerDocument: TestDocument;
  id = '';
  className = '';
  type = '';
  value = '';
  disabled = false;
  open = false;
  isConnected = true;
  parent?: TestElement;
  private ownText = '';

  constructor(readonly tagName: string, document: TestDocument) {
    super();
    this.ownerDocument = document;
  }
  set textContent(value: string) { this.ownText = value; this.replaceChildren(); }
  get textContent(): string { return this.ownText + this.children.map((child) => child.textContent).join(''); }
  get options(): TestElement[] { return this.children; }
  append(...nodes: TestElement[]): void { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes: TestElement[]): void { this.children.splice(0); this.append(...nodes); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  focus(): void { this.ownerDocument.activeElement = this; }
  click(): void { this.dispatchEvent(new Event('click')); }
  showModal(): void { this.open = true; }
  close(): void { this.open = false; this.dispatchEvent(new Event('close')); }
  remove(): void { this.isConnected = false; this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
  find(tag: string): TestElement | undefined {
    if (this.tagName === tag) return this;
    return this.children.map((child) => child.find(tag)).find(Boolean);
  }
  all(tag: string): TestElement[] {
    return [...(this.tagName === tag ? [this] : []), ...this.children.flatMap((child) => child.all(tag))];
  }
}

class TestDocument {
  activeElement: TestElement | null = null;
  createElement(tag: string): TestElement { return new TestElement(tag, this); }
}

const principal = {
  kind: 'verified' as const,
  manifestKey: `nip5d:15129:${'b'.repeat(64)}`,
  artifactHash: 'a'.repeat(64),
};
const requirement = {
  category: 'network' as const,
  domain: 'network', operation: 'network.connect-src',
  scope: { kind: 'origin' as const, value: 'https://api.example.test' },
};

function setup() {
  const document = new TestDocument();
  const mount = document.createElement('main');
  let grants: PermissionGrant[] = [];
  let available = true;
  const revoke = vi.fn((id: string) => { grants = grants.filter((grant) => grant.id !== id); return true; });
  const clear = vi.fn(() => { grants = []; return true; });
  const retryPersistence = vi.fn(() => { available = true; return true; });
  const permissions = {
    get grants() { return grants; }, get available() { return available; },
    revoke, clear, retryPersistence,
  } as unknown as RuntimePermissions;
  const onGrantRevoked = vi.fn();
  const ui = createBrowserApprovalUi({
    mount: mount as unknown as HTMLElement,
    labelForPrincipal: () => 'Trusted app',
    getPermissions: () => permissions,
    onGrantRevoked,
  });
  const prompt = (signal: AbortSignal, lifetimes: Array<'once' | 'session' | 'persistent'> = ['session']): ApprovalPrompt => ({
    request: { principal, sessionId: 's', requestId: 'r', requirements: [requirement] },
    missing: [requirement], signal, allowLifetimes: lifetimes,
  });
  return { document, mount, ui, prompt, revoke, clear, retryPersistence, onGrantRevoked,
    setGrants(value: PermissionGrant[]) { grants = value; },
    setAvailable(value: boolean) { available = value; } };
}

describe('common browser approval UI', () => {
  it('shows the full trusted identity and direct target, then requires an offered lifetime to allow', async () => {
    const f = setup();
    const controller = new AbortController();
    const answer = f.ui.prompt(f.prompt(controller.signal));
    const dialog = f.mount.find('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Trusted app');
    expect(dialog.textContent).toContain(principal.manifestKey);
    expect(dialog.textContent).toContain(principal.artifactHash);
    expect(dialog.textContent).toContain('network.connect-src origin:https://api.example.test');
    expect(dialog.textContent).toContain('outside parent mediation and rate limits');
    expect(dialog.textContent).toContain('HTTP to HTTPS');
    expect(dialog.textContent).toContain('default ports may upgrade');
    expect(dialog.getAttribute('aria-labelledby')).toBe('kehto-approval-title');
    const [deny, cancel, allow] = dialog.all('button');
    expect(f.document.activeElement).toBe(deny);
    expect(allow.disabled).toBe(true);
    expect(dialog.all('option').map((node) => node.value)).toEqual(['', 'session']);
    const select = dialog.find('select')!;
    select.value = 'session';
    select.dispatchEvent(new Event('change'));
    expect(allow.disabled).toBe(false);
    allow.click();
    expect(await answer).toEqual({ effect: 'allow', lifetime: 'session' });
    expect(dialog.open).toBe(false);
    expect(cancel).toBeDefined();
    f.ui.destroy();
  });

  it('does not apply browser scheme upgrades to mediated network approval', async () => {
    const f = setup();
    const request = f.prompt(new AbortController().signal);
    const answer = f.ui.prompt({ ...request, missing: [{ ...requirement, operation: 'fetch' }] });
    const dialog = f.mount.find('dialog')!;
    expect(dialog.textContent).toContain('The parent mediates and limits this operation.');
    expect(dialog.textContent).not.toContain('HTTP to HTTPS');
    dialog.all('button')[0].click();
    await answer;
    f.ui.destroy();
  });

  it('denies without storage and cancels on Escape, abort, and destruction', async () => {
    const f = setup();
    const first = f.ui.prompt(f.prompt(new AbortController().signal));
    f.mount.find('dialog')!.all('button')[0].click();
    expect(await first).toEqual({ effect: 'deny', lifetime: 'once' });

    const escape = f.ui.prompt(f.prompt(new AbortController().signal));
    const event = new Event('cancel', { cancelable: true });
    f.mount.find('dialog')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(await escape).toEqual({ effect: 'cancel' });

    const controller = new AbortController();
    const aborted = f.ui.prompt(f.prompt(controller.signal));
    controller.abort();
    expect(await aborted).toEqual({ effect: 'cancel' });

    const destroyed = f.ui.prompt(f.prompt(new AbortController().signal));
    f.ui.destroy();
    expect(await destroyed).toEqual({ effect: 'cancel' });
  });

  it('serializes distinct prompts and cancels a queued source without disturbing the active one', async () => {
    const f = setup();
    const first = f.ui.prompt(f.prompt(new AbortController().signal));
    const queuedController = new AbortController();
    const queued = f.ui.prompt({ ...f.prompt(queuedController.signal), missing: [{
      ...requirement, scope: { kind: 'origin', value: 'https://queued.example.test' },
    }] });
    const second = f.ui.prompt({ ...f.prompt(new AbortController().signal), missing: [{
      ...requirement, scope: { kind: 'origin', value: 'https://second.example.test' },
    }] });
    const dialog = f.mount.find('dialog')!;
    expect(dialog.textContent).toContain('https://api.example.test');
    expect(dialog.textContent).not.toContain('https://second.example.test');
    queuedController.abort();
    expect(await queued).toEqual({ effect: 'cancel' });
    expect(dialog.open).toBe(true);
    dialog.all('button')[0].click();
    expect(await first).toEqual({ effect: 'deny', lifetime: 'once' });
    await Promise.resolve();
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('https://second.example.test');
    dialog.dispatchEvent(new Event('close'));
    expect(dialog.open).toBe(true);
    f.ui.destroy();
    expect(await second).toEqual({ effect: 'cancel' });
  });

  it('refreshes the runtime grant list after the coordinator commits an approval', async () => {
    const f = setup();
    const grant: PermissionGrant = {
      id: 'committed-grant', principal, permission: requirement,
      effect: 'allow', lifetime: 'session', sessionId: 's',
    };
    const answer = f.ui.prompt(f.prompt(new AbortController().signal));
    const dialog = f.mount.find('dialog')!;
    const select = dialog.find('select')!;
    select.value = 'session';
    select.dispatchEvent(new Event('change'));
    dialog.all('button')[2].click();
    expect(await answer).toEqual({ effect: 'allow', lifetime: 'session' });
    f.setGrants([grant]);
    await Promise.resolve();
    await Promise.resolve();
    expect(f.mount.all('button').some((button) => button.textContent === 'Revoke')).toBe(true);
    f.ui.destroy();
  });

  it('renders runtime grants, revokes and clears them, and exposes storage recovery', () => {
    const f = setup();
    const grant: PermissionGrant = {
      id: 'grant-1', principal, permission: requirement,
      effect: 'allow', lifetime: 'persistent',
    };
    f.setGrants([grant]);
    f.ui.refresh();
    expect(f.mount.all('ul')[1]?.textContent).toContain('https://api.example.test');
    const revokeButton = f.mount.all('button').find((button) => button.textContent === 'Revoke')!;
    expect(revokeButton.getAttribute('aria-label')).toContain('https://api.example.test');
    revokeButton.click();
    expect(f.revoke).toHaveBeenCalledWith('grant-1');
    expect(f.onGrantRevoked).toHaveBeenCalledWith(grant, true);
    expect(f.mount.all('button').some((button) => button.textContent === 'Revoke')).toBe(false);

    f.setGrants([grant]);
    f.ui.refresh();
    f.mount.all('button').find((button) => button.textContent === 'Clear all grants')!.click();
    expect(f.clear).toHaveBeenCalledOnce();
    expect(f.onGrantRevoked).toHaveBeenCalledTimes(2);

    f.setAvailable(false);
    f.ui.reportStorageError('save-failed');
    expect(f.mount.textContent).toContain('Permission storage save-failed');
    f.mount.all('button').find((button) => button.textContent === 'Retry permission storage')!.click();
    expect(f.retryPersistence).toHaveBeenCalledOnce();
    expect(f.mount.textContent).not.toContain('Permission storage save-failed');
    f.ui.destroy();
  });

  it('explains that missing browser storage limits approval lifetimes', () => {
    const f = setup();
    f.ui.reportStorageError('storage-unavailable');
    expect(f.mount.textContent).toContain('only session and once approvals can be offered');
    f.ui.destroy();
  });
});
