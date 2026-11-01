import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPajaConfirmationController } from './browser-host-signer.js';
import type { PajaConfirmationRequest } from './browser-adapter.js';

class FakeHTMLElement {
  readonly listeners = new Map<string, Set<(event: Event) => void>>();
  textContent = '';
  hidden = false;
  focusCalls = 0;

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback = typeof listener === 'function'
      ? listener
      : (event: Event) => listener.handleEvent(event);
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(callback);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') return;
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    const event = { preventDefault: vi.fn() } as unknown as Event;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  focus(): void {
    this.focusCalls += 1;
  }
}

class FakeButton extends FakeHTMLElement {
  click(): void { this.emit('click'); }
}

class FakeInput extends FakeHTMLElement {
  checked = false;
}

class FakeFieldSet extends FakeHTMLElement {}

class FakeDialog extends FakeHTMLElement {
  open = false;
  showCalls = 0;

  showModal(): void {
    this.open = true;
    this.showCalls += 1;
  }

  close(): void {
    this.open = false;
  }
}

class FakeStorage implements Storage {
  readonly records = new Map<string, string>();

  get length(): number { return this.records.size; }
  clear(): void { this.records.clear(); }
  getItem(key: string): string | null { return this.records.get(key) ?? null; }
  key(index: number): string | null { return [...this.records.keys()][index] ?? null; }
  removeItem(key: string): void { this.records.delete(key); }
  setItem(key: string, value: string): void { this.records.set(key, value); }
}

interface ConfirmationDom {
  readonly dialog: FakeDialog;
  readonly approve: FakeButton;
  readonly deny: FakeButton;
  readonly consent: FakeFieldSet;
  readonly once: FakeInput;
  readonly kind: FakeInput;
  readonly napplet: FakeInput;
  readonly version: FakeInput;
  readonly kindValue: FakeHTMLElement;
  readonly nappletValue: FakeHTMLElement;
}

function installConfirmationDom(): ConfirmationDom {
  const dom: ConfirmationDom = {
    dialog: new FakeDialog(),
    approve: new FakeButton(),
    deny: new FakeButton(),
    consent: new FakeFieldSet(),
    once: new FakeInput(),
    kind: new FakeInput(),
    napplet: new FakeInput(),
    version: new FakeInput(),
    kindValue: new FakeHTMLElement(),
    nappletValue: new FakeHTMLElement(),
  };
  const elements = new Map<string, FakeHTMLElement>([
    ['paja-confirmation-dialog', dom.dialog],
    ['paja-confirmation-title', new FakeHTMLElement()],
    ['paja-confirmation-summary', new FakeHTMLElement()],
    ['paja-confirmation-details', new FakeHTMLElement()],
    ['paja-confirmation-approve', dom.approve],
    ['paja-confirmation-deny', dom.deny],
    ['paja-signer-consent', dom.consent],
    ['paja-signer-consent-once', dom.once],
    ['paja-signer-consent-kind', dom.kind],
    ['paja-signer-consent-napplet', dom.napplet],
    ['paja-signer-consent-version', dom.version],
    ['paja-signer-consent-kind-value', dom.kindValue],
    ['paja-signer-consent-napplet-value', dom.nappletValue],
  ]);
  vi.stubGlobal('HTMLElement', FakeHTMLElement);
  vi.stubGlobal('HTMLButtonElement', FakeButton);
  vi.stubGlobal('HTMLInputElement', FakeInput);
  vi.stubGlobal('HTMLFieldSetElement', FakeFieldSet);
  vi.stubGlobal('HTMLDialogElement', FakeDialog);
  vi.stubGlobal('document', {
    activeElement: null,
    getElementById: (id: string) => elements.get(id) ?? null,
  });
  return dom;
}

type SignConfirmationRequest = Extract<
  PajaConfirmationRequest,
  { readonly event: unknown }
> & { readonly action: 'sign' };

function signRequest(kind: number, aggregateHash = 'aggregate-a'): SignConfirmationRequest {
  return {
    action: 'sign',
    event: { kind, created_at: 1, tags: [], content: 'hello' },
    signerContext: {
      signerPubkey: 'a'.repeat(64),
      windowId: 'window-a',
      runtimeScope: 'artifact:aggregate-a',
      napplet: { dTag: 'profile-viewer', aggregateHash },
    },
  };
}

describe('Paja confirmation controller', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('allows signing and publication only after explicit version approval and drains matching queued work', async () => {
    const dom = installConfirmationDom();
    const controller = createPajaConfirmationController(() => null, { storage: new FakeStorage() });
    const sign = controller.confirm(signRequest(1));
    const publish = controller.confirm({ ...signRequest(1), action: 'publish' });
    dom.version.checked = true;
    dom.approve.click();
    await expect(sign).resolves.toBe(true);
    await expect(publish).resolves.toBe(true);
    expect(dom.dialog.showCalls).toBe(1);
    await expect(controller.confirm({ ...signRequest(30_023), action: 'publish' })).resolves.toBe(true);
    const changed = controller.confirm({ ...signRequest(1, 'another-version'), action: 'publish' });
    expect(dom.dialog.open).toBe(true);
    dom.deny.click();
    await expect(changed).resolves.toBe(false);
  });

  it('never treats signing-only approval as publication permission', async () => {
    const dom = installConfirmationDom();
    const controller = createPajaConfirmationController(() => null, { storage: new FakeStorage() });
    const sign = controller.confirm(signRequest(1));
    dom.napplet.checked = true;
    dom.approve.click();
    await sign;
    const publish = controller.confirm({ ...signRequest(1), action: 'publish' });
    expect(dom.dialog.open).toBe(true);
    expect(dom.consent.hidden).toBe(false);
    dom.deny.click();
    await expect(publish).resolves.toBe(false);
  });

  it('denies stale approvals and cancels active and queued requests on endpoint removal', async () => {
    const dom = installConfirmationDom();
    const controller = createPajaConfirmationController(() => null, { storage: new FakeStorage() });
    let current = true;
    const request = { ...signRequest(1), isCurrent: () => current };
    const pending = controller.confirm(request);
    current = false;
    dom.version.checked = true;
    dom.approve.click();
    await expect(pending).resolves.toBe(false);
    expect(controller.getSignerConsentCount()).toBe(0);
    const active = controller.confirm(signRequest(1));
    const queued = controller.confirm({ ...signRequest(1), action: 'publish' });
    controller.cancelWindow('window-a');
    await expect(active).resolves.toBe(false);
    await expect(queued).resolves.toBe(false);
    expect(dom.dialog.open).toBe(false);
  });

  it('withdraws queued and open prompts when their request signal aborts', async () => {
    const dom = installConfirmationDom();
    const controller = createPajaConfirmationController(() => null, { storage: new FakeStorage() });
    expect(await controller.confirm({ ...signRequest(1), signal: AbortSignal.abort() })).toBe(false);
    expect(dom.dialog.showCalls).toBe(0);

    const activeAbort = new AbortController();
    const queuedAbort = new AbortController();
    const active = controller.confirm({ ...signRequest(1), signal: activeAbort.signal });
    const queued = controller.confirm({ ...signRequest(2), signal: queuedAbort.signal });
    const later = controller.confirm(signRequest(3));
    queuedAbort.abort();
    await expect(queued).resolves.toBe(false);
    expect(dom.dialog.open).toBe(true);
    activeAbort.abort();
    await expect(active).resolves.toBe(false);
    await Promise.resolve();
    expect(dom.dialog.open).toBe(true);
    dom.approve.click();
    await expect(later).resolves.toBe(true);

    const answered = new AbortController();
    const approved = controller.confirm({ ...signRequest(4), signal: answered.signal });
    dom.approve.click();
    await expect(approved).resolves.toBe(true);
    answered.abort();
    expect(dom.dialog.open).toBe(false);
  });

  it('remembers an exact event kind and skips only matching prompts', async () => {
    const dom = installConfirmationDom();
    const onSignerConsentChange = vi.fn();
    const controller = createPajaConfirmationController(
      () => null,
      { storage: new FakeStorage(), onSignerConsentChange },
    );

    const first = controller.confirm(signRequest(1));
    expect(dom.dialog.open).toBe(true);
    expect(dom.consent.hidden).toBe(false);
    expect(dom.kindValue.textContent).toBe('1');
    expect(dom.nappletValue.textContent).toBe('profile-viewer');
    dom.once.checked = false;
    dom.kind.checked = true;
    dom.approve.click();
    await expect(first).resolves.toBe(true);
    expect(controller.getSignerConsentCount()).toBe(1);
    expect(onSignerConsentChange).toHaveBeenLastCalledWith(1);

    const showCalls = dom.dialog.showCalls;
    await expect(controller.confirm(signRequest(1))).resolves.toBe(true);
    expect(dom.dialog.showCalls).toBe(showCalls);

    const differentKind = controller.confirm(signRequest(2));
    expect(dom.dialog.open).toBe(true);
    dom.deny.click();
    await expect(differentKind).resolves.toBe(false);

    const changedArtifact = controller.confirm(signRequest(1, 'aggregate-b'));
    expect(dom.dialog.open).toBe(true);
    dom.deny.click();
    await expect(changedArtifact).resolves.toBe(false);
    expect(controller.getSignerConsentCount()).toBe(1);
  });

  it('warned napplet trust covers all kinds until explicitly revoked', async () => {
    const dom = installConfirmationDom();
    const controller = createPajaConfirmationController(
      () => null,
      { storage: new FakeStorage() },
    );

    const first = controller.confirm(signRequest(1));
    dom.once.checked = false;
    dom.napplet.checked = true;
    dom.approve.click();
    await expect(first).resolves.toBe(true);

    const showCalls = dom.dialog.showCalls;
    await expect(controller.confirm(signRequest(30_023))).resolves.toBe(true);
    expect(dom.dialog.showCalls).toBe(showCalls);

    controller.clearSignerConsent();
    expect(controller.getSignerConsentCount()).toBe(0);
    const afterRevocation = controller.confirm(signRequest(30_023));
    expect(dom.dialog.showCalls).toBe(showCalls + 1);
    dom.deny.click();
    await expect(afterRevocation).resolves.toBe(false);
  });

  it('keeps unscoped and unknown-kind signatures one-shot and never remembers denial', async () => {
    const dom = installConfirmationDom();
    const controller = createPajaConfirmationController(
      () => null,
      { storage: new FakeStorage() },
    );
    const unscoped: PajaConfirmationRequest = {
      action: 'sign',
      event: { kind: 1, created_at: 1, tags: [], content: '' },
    };
    const pending = controller.confirm(unscoped);
    expect(dom.consent.hidden).toBe(true);
    dom.dialog.emit('cancel');
    await expect(pending).resolves.toBe(false);
    expect(controller.getSignerConsentCount()).toBe(0);

    const unknownKind = controller.confirm({
      ...signRequest(1),
      event: { content: 'missing kind' },
    });
    expect(dom.consent.hidden).toBe(true);
    dom.approve.click();
    await expect(unknownKind).resolves.toBe(true);
    expect(controller.getSignerConsentCount()).toBe(0);

    const invalidRequest = signRequest(1);
    const invalidContext = controller.confirm({
      ...invalidRequest,
      signerContext: { ...invalidRequest.signerContext!, runtimeScope: '' },
    });
    expect(dom.consent.hidden).toBe(true);
    dom.deny.click();
    await expect(invalidContext).resolves.toBe(false);
  });
});
