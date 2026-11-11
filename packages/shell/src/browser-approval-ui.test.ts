import { describe, expect, it, vi } from 'vitest';
import { createPermissionRules, permissionRuleSubject } from '@kehto/runtime';
import type { ApprovalPrompt, PermissionGrant, PermissionRequirement, PermissionRules, RuntimePermissions } from '@kehto/runtime';
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
  checked = false;
  hidden = false;
  title = '';
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

const linkOpen: PermissionRequirement = {
  category: 'resource', domain: 'link', operation: 'link.open',
  scope: { kind: 'exact', value: 'https://example.org/post/1' },
};
const keysGrant = (id: string, value: string, lifetime: 'session' | 'persistent' = 'session'): PermissionGrant => ({
  id, principal, effect: 'allow', lifetime, ...(lifetime === 'session' ? { sessionId: 's' } : {}),
  permission: { category: 'resource', domain: 'keys', operation: 'keys.registerAction', scope: { kind: 'exact', value } },
});
const byText = (root: TestElement, tag: string, text: string): TestElement | undefined =>
  root.all(tag).find((node) => node.textContent === text);
const DEFAULTS = createPermissionRules({ default: 'allow', operations: { 'link.open': 'ask' } });

function setup(separatePrompt = false, withRules = false) {
  const document = new TestDocument();
  const mount = document.createElement('main');
  const promptMount = document.createElement('aside');
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
  let rules: PermissionRules = DEFAULTS;
  const setRules = vi.fn((next: PermissionRules) => { rules = next; });
  const ui = createBrowserApprovalUi({
    ...(withRules ? { rules: { get: () => rules, set: setRules, defaults: () => DEFAULTS } } : {}),
    mount: mount as unknown as HTMLElement,
    ...(separatePrompt ? { promptMount: promptMount as unknown as HTMLElement } : {}),
    labelForPrincipal: () => 'Trusted app',
    getPermissions: () => permissions,
    onGrantRevoked,
  });
  const prompt = (signal: AbortSignal, lifetimes: Array<'once' | 'session' | 'persistent'> = ['session']): ApprovalPrompt => ({
    request: { principal, sessionId: 's', requestId: 'r', requirements: [requirement] },
    missing: [requirement], signal, allowLifetimes: lifetimes,
  });
  return { document, mount, promptMount, ui, prompt, revoke, clear, retryPersistence, onGrantRevoked, setRules,
    rules: () => rules,
    setGrants(value: PermissionGrant[]) { grants = value; },
    setAvailable(value: boolean) { available = value; } };
}

describe('common browser approval UI', () => {
  it('keeps prompts outside collapsible management and removes both mounts on destroy', async () => {
    const f = setup(true);
    const answer = f.ui.prompt(f.prompt(new AbortController().signal));
    expect(f.mount.find('dialog')).toBeUndefined();
    expect(f.mount.textContent).toContain('Firewall grants');
    const dialog = f.promptMount.find('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.parent?.className).toBe('kehto-approval-ui');
    expect(f.promptMount.textContent).toContain('Permission request');
    f.ui.destroy();
    await expect(answer).resolves.toEqual({ effect: 'cancel' });
    expect(f.mount.children).toHaveLength(0);
    expect(f.promptMount.children).toHaveLength(0);
  });

  it('shows the trusted identity and exact direct target, and allows in one click', async () => {
    const f = setup();
    const answer = f.ui.prompt(f.prompt(new AbortController().signal));
    const dialog = f.mount.find('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.find('h2')!.textContent).toBe('Allow direct network access?');
    expect(dialog.textContent).toContain('Trusted app');
    expect(dialog.textContent).toContain(principal.manifestKey);
    expect(dialog.textContent).toContain(principal.artifactHash);
    expect(dialog.find('code')!.textContent).toBe('https://api.example.test');
    expect(dialog.textContent).toContain('outside parent mediation and rate limits');
    expect(dialog.textContent).toContain('HTTP to HTTPS');
    expect(dialog.textContent).toContain('default ports may upgrade');
    expect(dialog.getAttribute('aria-labelledby')).toBe('kehto-approval-title');
    // Focus starts on Deny: a stray Enter must not grant access.
    expect(f.document.activeElement).toBe(byText(dialog, 'button', 'Deny'));
    const allow = byText(dialog, 'button', 'Allow')!;
    expect(allow.disabled).toBe(false);
    allow.click();
    expect(await answer).toEqual({ effect: 'allow', lifetime: 'session' });
    expect(dialog.open).toBe(false);
    f.ui.destroy();
  });

  it('preselects the narrowest offered lifetime and answers with the one the user picks', async () => {
    const f = setup();
    const offered = ['once', 'session', 'persistent'] as const;
    const first = f.ui.prompt(f.prompt(new AbortController().signal, [...offered]));
    const dialog = f.mount.find('dialog')!;
    const pressed = () => dialog.all('button').filter((node) => node.getAttribute('aria-pressed') === 'true').map((node) => node.textContent);
    expect(pressed()).toEqual(['Just this once']);
    byText(dialog, 'button', 'Allow')!.click();
    expect(await first).toEqual({ effect: 'allow', lifetime: 'once' });
    await Promise.resolve();

    const second = f.ui.prompt(f.prompt(new AbortController().signal, [...offered]));
    byText(dialog, 'button', 'Always')!.click();
    expect(pressed()).toEqual(['Always']);
    byText(dialog, 'button', 'Allow')!.click();
    expect(await second).toEqual({ effect: 'allow', lifetime: 'persistent' });
    f.ui.destroy();
  });

  it('names a link request in plain words and shows its exact destination', async () => {
    const f = setup();
    const answer = f.ui.prompt({ ...f.prompt(new AbortController().signal, ['once', 'session']), missing: [linkOpen] });
    const dialog = f.mount.find('dialog')!;
    expect(dialog.find('h2')!.textContent).toBe('Open an external link?');
    expect(dialog.find('li')!.textContent).toBe('Open linkhttps://example.org/post/1');
    byText(dialog, 'button', 'Deny')!.click();
    expect(await answer).toEqual({ effect: 'deny', lifetime: 'once' });
    f.ui.destroy();
  });

  it('merges the directives of one direct origin into a single row', async () => {
    const f = setup();
    const answer = f.ui.prompt({ ...f.prompt(new AbortController().signal), missing: [
      requirement, { ...requirement, operation: 'network.script-src' },
      { ...requirement, scope: { kind: 'origin', value: 'wss://api.example.test' } },
    ] });
    const dialog = f.mount.find('dialog')!;
    expect(dialog.all('li').map((row) => row.textContent)).toEqual([
      'Connect directly (connect-src, script-src)https://api.example.test',
      'Connect directly (connect-src)wss://api.example.test',
    ]);
    f.ui.destroy();
    await answer;
  });

  it('does not apply browser scheme upgrades to mediated network approval', async () => {
    const f = setup();
    const request = f.prompt(new AbortController().signal);
    const answer = f.ui.prompt({ ...request, missing: [{ ...requirement, operation: 'fetch' }] });
    const dialog = f.mount.find('dialog')!;
    expect(dialog.textContent).toContain('The parent mediates and limits this operation.');
    expect(dialog.textContent).not.toContain('HTTP to HTTPS');
    byText(dialog, 'button', 'Deny')!.click();
    await answer;
    f.ui.destroy();
  });

  it('denies without storage and cancels on Escape, abort, and destruction', async () => {
    const f = setup();
    const first = f.ui.prompt(f.prompt(new AbortController().signal));
    byText(f.mount.find('dialog')!, 'button', 'Deny')!.click();
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

  it('serializes distinct prompts, counts the queue, and cancels a queued source without disturbing the active one', async () => {
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
    expect(dialog.find('p')!.textContent).toBe('Permission request · 2 more waiting');
    queuedController.abort();
    expect(await queued).toEqual({ effect: 'cancel' });
    expect(dialog.find('p')!.textContent).toBe('Permission request · 1 more waiting');
    expect(dialog.open).toBe(true);
    byText(dialog, 'button', 'Deny')!.click();
    expect(await first).toEqual({ effect: 'deny', lifetime: 'once' });
    await Promise.resolve();
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('https://second.example.test');
    expect(dialog.find('p')!.textContent).toBe('Permission request');
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
    byText(f.mount.find('dialog')!, 'button', 'Allow')!.click();
    expect(await answer).toEqual({ effect: 'allow', lifetime: 'session' });
    f.setGrants([grant]);
    await Promise.resolve();
    await Promise.resolve();
    expect(byText(f.mount, 'button', 'Revoke')).toBeDefined();
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
    expect(f.mount.find('li')!.textContent).toContain('https://api.example.test');
    const revokeButton = byText(f.mount, 'button', 'Revoke')!;
    expect(revokeButton.getAttribute('aria-label')).toBe('Revoke network.connect-src origin:https://api.example.test');
    revokeButton.click();
    expect(f.revoke).toHaveBeenCalledWith('grant-1');
    expect(f.onGrantRevoked).toHaveBeenCalledWith(grant, true);
    expect(byText(f.mount, 'button', 'Revoke')).toBeUndefined();
    expect(f.mount.textContent).toContain('No grants yet');

    f.setGrants([grant]);
    f.ui.refresh();
    byText(f.mount, 'button', 'Clear all grants')!.click();
    expect(f.clear).toHaveBeenCalledOnce();
    expect(f.onGrantRevoked).toHaveBeenCalledTimes(2);

    f.setAvailable(false);
    f.ui.reportStorageError('save-failed');
    expect(f.mount.textContent).toContain('Permission storage save-failed');
    byText(f.mount, 'button', 'Retry permission storage')!.click();
    expect(f.retryPersistence).toHaveBeenCalledOnce();
    expect(f.mount.textContent).not.toContain('Permission storage save-failed');
    f.ui.destroy();
  });

  it('states a napplet identity once and groups its grants by interface', () => {
    const f = setup();
    const grants = Array.from({ length: 40 }, (_, index) => keysGrant(`keys-${index}`, `keys:action:app.action-${index}`, 'persistent'));
    f.setGrants([...grants, { id: 'net', principal, permission: requirement, effect: 'deny', lifetime: 'persistent' }]);
    f.ui.refresh();
    const napplets = f.mount.all('details').filter((node) => node.className === 'kehto-fw-napplet');
    expect(napplets).toHaveLength(1);
    expect(napplets[0].open).toBe(true);
    expect(napplets[0].find('summary')!.textContent).toBe('Trusted appverified41 grants');
    // The full identity is a tooltip; the visible line is shortened and appears once.
    expect(f.mount.textContent.split(principal.artifactHash)).toHaveLength(1);
    expect(byText(f.mount, 'p', '15129:bbbbbbbb…bbbbbb · artifact aaaaaaaa…aaaaaa')!.title).toContain(principal.artifactHash);
    const domains = f.mount.all('details').filter((node) => node.className === 'kehto-fw-domain');
    expect(domains.map((node) => node.find('summary')!.textContent)).toEqual(['keys40 decisions', 'network1 decision']);
    expect(domains.every((node) => !node.open)).toBe(true);
    expect(domains[0].find('li')!.textContent).toBe('AllowedRegister shortcutaction app.action-0AlwaysRevoke');
    expect(domains[1].find('li')!.textContent).toContain('Blocked');

    // The host hears about a group only after every grant in it is gone.
    f.onGrantRevoked.mockImplementation(() => { expect(f.revoke).toHaveBeenCalledTimes(40); });
    byText(f.mount, 'button', 'Revoke all keys')!.click();
    expect(f.revoke).toHaveBeenCalledTimes(40);
    expect(f.onGrantRevoked).toHaveBeenCalledTimes(40);
    expect(f.mount.all('details').filter((node) => node.className === 'kehto-fw-domain')).toHaveLength(1);
    f.ui.destroy();
  });

  it('keeps a group the user collapsed closed across re-renders', () => {
    const f = setup();
    f.setGrants([keysGrant('keys-1', 'keys:chord:Escape', 'persistent')]);
    f.ui.refresh();
    const domain = () => f.mount.all('details').find((node) => node.className === 'kehto-fw-domain')!;
    const opened = domain();
    opened.open = true;
    opened.dispatchEvent(new Event('toggle'));
    f.ui.refresh();
    expect(domain()).not.toBe(opened);
    expect(domain().open).toBe(true);
    f.ui.destroy();
  });

  it('summarizes scopes allowed by default rules instead of listing each one', () => {
    const f = setup();
    f.setGrants(Array.from({ length: 100 }, (_, index) => keysGrant(`rule:r${index}-0`, `keys:action:app.action-${index}`)));
    f.ui.refresh();
    expect(f.mount.textContent).toContain('100 scopes allowed by default rules until it closes');
    expect(f.mount.all('li')).toHaveLength(0);
    byText(f.mount, 'button', 'Reset')!.click();
    expect(f.revoke).toHaveBeenCalledTimes(100);
    f.ui.destroy();
  });

  it('explains that missing browser storage limits approval lifetimes', () => {
    const f = setup();
    f.ui.reportStorageError('storage-unavailable');
    expect(f.mount.textContent).toContain('only session and once approvals can be offered');
    f.ui.destroy();
  });
});

describe('browser approval default rules', () => {
  const subject = permissionRuleSubject(principal);
  const ruleList = (root: TestElement) => root.all('ul').find((node) => node.className === 'kehto-fw-rule-list')!;
  const ruleSelects = (root: TestElement) => ruleList(root).all('select');

  it('has no rule editor or standing-rule offer unless the host supplies rules', async () => {
    const f = setup();
    expect(f.mount.textContent).not.toContain('Default rules');
    const answer = f.ui.prompt({ ...f.prompt(new AbortController().signal), missing: [linkOpen] });
    expect(f.mount.find('label')!.hidden).toBe(true);
    f.ui.destroy();
    await answer;
  });

  it('lists the default and each exception, and changes one in place', () => {
    const f = setup(false, true);
    const rows = ruleList(f.mount).all('li');
    expect(rows.map((row) => row.find('span')!.textContent)).toEqual(['Everything elseevery napplet', 'link.openevery napplet']);
    expect(ruleSelects(f.mount).map((node) => node.value)).toEqual(['allow', 'ask']);
    expect(rows[0].all('button')).toHaveLength(0);
    const fallback = ruleSelects(f.mount)[0];
    fallback.value = 'ask';
    fallback.dispatchEvent(new Event('change'));
    expect(f.rules().default).toBe('ask');
    expect(ruleSelects(f.mount).map((node) => node.value)).toEqual(['ask', 'ask']);
    f.ui.destroy();
  });

  it('adds an interface or operation rule for every napplet or one, and removes it', () => {
    const f = setup(false, true);
    f.setGrants([keysGrant('keys-1', 'keys:chord:Escape', 'persistent')]);
    f.ui.refresh();
    const form = f.mount.find('form')!;
    const [scope, action] = form.all('select');
    const capability = form.find('input')!;
    expect(scope.all('option').map((node) => [node.value, node.textContent])).toEqual([['', 'Every napplet'], [subject, 'Trusted app']]);
    expect(form.find('datalist')!.all('option').map((node) => node.value)).toEqual(['keys', 'keys.registerAction']);

    capability.value = 'fs';
    action.value = 'deny';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(f.rules().domains).toEqual({ fs: 'deny' });
    expect(capability.value).toBe('');

    capability.value = ' keys.registerAction ';
    scope.value = subject;
    action.value = 'ask';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(f.rules().napplets[subject]).toEqual({ domains: {}, operations: { 'keys.registerAction': 'ask' } });
    expect(ruleList(f.mount).textContent).toContain('keys.registerActionTrusted app');

    f.mount.all('button').find((node) => node.getAttribute('aria-label') === 'Remove rule for fs (whole interface), every napplet')!.click();
    expect(f.rules().domains).toEqual({});
    f.ui.destroy();
  });

  it('rejects text that names neither an interface nor an operation', () => {
    const f = setup(false, true);
    const form = f.mount.find('form')!;
    form.find('input')!.value = 'Open Links!';
    const submit = new Event('submit', { cancelable: true });
    form.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    expect(f.setRules).not.toHaveBeenCalled();
    expect(f.mount.textContent).toContain('Enter an interface such as link, or an operation such as link.open.');
    f.ui.destroy();
  });

  it('restores the host defaults', () => {
    const f = setup(false, true);
    const fallback = ruleSelects(f.mount)[0];
    fallback.value = 'deny';
    fallback.dispatchEvent(new Event('change'));
    expect(f.rules()).not.toEqual(DEFAULTS);
    byText(f.mount, 'button', 'Restore defaults')!.click();
    expect(f.rules()).toEqual(DEFAULTS);
    f.ui.destroy();
  });

  it('resets grants made by a rule once that rule stops allowing them, and keeps answered decisions', () => {
    const f = setup(false, true);
    const byRule = keysGrant('rule:r1-0', 'keys:chord:Escape');
    const answered = keysGrant('answered', 'keys:chord:Ctrl+N');
    f.setGrants([byRule, answered]);
    f.ui.refresh();
    const form = f.mount.find('form')!;
    form.find('input')!.value = 'link';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(f.revoke).not.toHaveBeenCalled();

    form.find('input')!.value = 'keys';
    form.all('select')[1].value = 'ask';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(f.revoke.mock.calls).toEqual([['rule:r1-0']]);
    expect(f.onGrantRevoked).toHaveBeenCalledWith(byRule, true);
    f.ui.destroy();
  });

  it('turns a prompt answer into a standing rule for that napplet and operation', async () => {
    const f = setup(false, true);
    const answer = f.ui.prompt({ ...f.prompt(new AbortController().signal, ['once', 'session', 'persistent']), missing: [linkOpen] });
    const dialog = f.mount.find('dialog')!;
    const label = dialog.find('label')!;
    expect(label.hidden).toBe(false);
    expect(label.textContent).toBe('Do this for every future link.open request from this napplet');
    const box = label.find('input')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(byText(dialog, 'button', 'Just this once')!.disabled).toBe(true);
    byText(dialog, 'button', 'Allow')!.click();
    // The rule covers later requests, so the exact grant only needs this session.
    expect(await answer).toEqual({ effect: 'allow', lifetime: 'session' });
    expect(f.rules().napplets[subject]).toEqual({ domains: {}, operations: { 'link.open': 'allow' } });

    await Promise.resolve();
    const denied = f.ui.prompt({ ...f.prompt(new AbortController().signal, ['once']), missing: [{
      category: 'interface', domain: 'fs', operation: 'access', scope: { kind: 'exact', value: 'fs' },
    }] });
    expect(label.textContent).toBe('Do this for every future fs interface request from this napplet');
    expect(box.checked).toBe(false);
    box.checked = true;
    byText(dialog, 'button', 'Deny')!.click();
    expect(await denied).toEqual({ effect: 'deny', lifetime: 'once' });
    expect(f.rules().napplets[subject].domains).toEqual({ fs: 'deny' });
    f.ui.destroy();
  });

  it('offers no standing rule for a prompt spanning several interfaces', async () => {
    const f = setup(false, true);
    const answer = f.ui.prompt({ ...f.prompt(new AbortController().signal), missing: [linkOpen, requirement] });
    expect(f.mount.find('dialog')!.find('label')!.hidden).toBe(true);
    f.ui.destroy();
    await answer;
  });

  it('keeps the one-off answer when the rule cannot be saved', async () => {
    const f = setup(false, true);
    f.setRules.mockImplementation(() => { throw new Error('quota'); });
    const answer = f.ui.prompt({ ...f.prompt(new AbortController().signal, ['once']), missing: [linkOpen] });
    const dialog = f.mount.find('dialog')!;
    dialog.find('label')!.find('input')!.checked = true;
    byText(dialog, 'button', 'Allow')!.click();
    expect(await answer).toEqual({ effect: 'allow', lifetime: 'once' });
    f.ui.destroy();
  });
});
