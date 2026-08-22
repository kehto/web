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
