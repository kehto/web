import {
  createPajaIntentLink,
  type ParsedPajaIntentLink,
} from './intent-link.js';
import {
  appendIntentLinkBuilderOption,
  createIntentLinkBuilderElements,
} from './browser-intent-builder-controls.js';
import {
  appendIntentLinkBuilderParameterRow,
  type IntentLinkBuilderParameterRow,
} from './browser-intent-builder-rows.js';
import { buildIntentLinkBuilderPayload } from './browser-intent-builder-payload.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';

let nextBuilderId = 0;

/** Configuration for a native Paja intent-link builder. */
export interface PajaIntentLinkBuilderOptions {
  /** Receive a validated link only after the user explicitly chooses Test intent. */
  onTest(link: ParsedPajaIntentLink): void | Promise<void>;
  /** Return the Paja location used as the share-link base. */
  href?: () => string;
}

/** Native builder controls owned by the host integration. */
export interface PajaIntentLinkBuilder {
  /** Open the builder from an already verified target; this never fetches or runs it. */
  open(target: PajaResolvedPointer): void;
  /** Remove the dialog and listeners created by this builder. */
  dispose(): void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to create this intent link.';
}

/**
 * Create a native dialog that turns verified manifest contracts into Paja intent links.
 *
 * @param options - Explicit test callback and optional URL-base resolver.
 * @returns Controls for opening and disposing the builder.
 * @example
 * ```ts
 * const builder = createPajaIntentLinkBuilder({ onTest: (link) => launch(link) });
 * builder.open(verifiedTarget);
 * ```
 */
export function createPajaIntentLinkBuilder(options: PajaIntentLinkBuilderOptions): PajaIntentLinkBuilder {
  const id = `paja-intent-builder-${++nextBuilderId}`;
  const href = options.href ?? (() => window.location.href);
  const {
    dialog,
    status,
    cancel,
    copy,
    test,
    convention,
    routing,
    payloadMode,
    parameterGroup,
    parameterRows,
    addParameter,
    jsonField,
    json,
    preview,
    link,
  } = createIntentLinkBuilderElements(id);

  let opener: HTMLElement | null = null;
  let target: PajaResolvedPointer | null = null;
  let contracts: PajaResolvedPointer['manifest']['archetypes'] = [];
  let rows: IntentLinkBuilderParameterRow[] = [];
  let disposed = false;

  function close(restoreFocus = true): void {
    if (dialog.open) dialog.close();
    if (restoreFocus) opener?.focus();
    opener = null;
  }

  function addRow(name: string, custom: boolean): void {
    rows.push(appendIntentLinkBuilderParameterRow(
      parameterRows,
      id,
      rows.length,
      name,
      custom,
      updatePreview,
    ));
  }

  function selectedContract(): PajaResolvedPointer['manifest']['archetypes'][number] | null {
    return contracts.find((entry) => entry.convention === convention.control.value) ?? null;
  }

  function resetRows(): void {
    parameterRows.replaceChildren();
    rows = [];
    for (const name of selectedContract()?.params ?? []) addRow(name, false);
  }

  function build(): ParsedPajaIntentLink {
    const contract = selectedContract();
    if (!target || !contract) throw new TypeError('Choose one advertised convention first.');
    return buildIntentLinkBuilderPayload({
      target,
      convention: contract.convention,
      rows,
      mode: payloadMode.control.value,
      routing: routing.control.value,
      json: json.value,
      href: href(),
    });
  }

  function updatePreview(): void {
    const jsonMode = payloadMode.control.value === 'json';
    parameterGroup.hidden = jsonMode;
    jsonField.hidden = !jsonMode;
    try {
      const parsed = build();
      const payload = Object.hasOwn(parsed.request, 'payload')
        ? JSON.stringify(parsed.request.payload)
        : 'none';
      const targetDescription = parsed.pointer
        ? 'exact verified target pointer'
        : parsed.request.handlerHint
          ? 'recommended named app'
          : 'recipient default';
      preview.textContent = `Convention: ${parsed.request.convention}\nPayload: ${payload}\nRouting: ${targetDescription}`;
      link.value = createPajaIntentLink({
        uri: parsed.uri,
        ...(parsed.pointer === undefined ? {} : { pointer: parsed.pointer }),
        ...(Object.hasOwn(parsed, 'payload') ? { payload: parsed.payload } : {}),
      }, href());
      status.textContent = '';
    } catch (error) {
      preview.textContent = '';
      link.value = '';
      status.textContent = message(error);
    }
  }

  function populate(nextTarget: PajaResolvedPointer): void {
    target = nextTarget;
    contracts = [...nextTarget.manifest.archetypes];
    convention.control.replaceChildren();
    routing.control.replaceChildren();
    payloadMode.control.replaceChildren();
    for (const contract of contracts) appendIntentLinkBuilderOption(convention.control, contract.convention, contract.convention);
    appendIntentLinkBuilderOption(routing.control, 'default', 'Recipient default');
    appendIntentLinkBuilderOption(routing.control, 'recommend', 'Recommend this app', nextTarget.event.kind !== 35129 || !nextTarget.manifest.dTag);
    appendIntentLinkBuilderOption(routing.control, 'exact', 'Exact target pointer');
    appendIntentLinkBuilderOption(payloadMode.control, 'text', 'Text fields');
    appendIntentLinkBuilderOption(payloadMode.control, 'json', 'JSON payload');
    json.value = '';
    resetRows();
    updatePreview();
  }

  const onConvention = () => { resetRows(); updatePreview(); };
  const onChange = () => updatePreview();
  const onAddParameter = () => { addRow('', true); updatePreview(); };
  const onCancel = () => close();
  const onCopy = async () => {
    updatePreview();
    if (!link.value) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(link.value);
      status.textContent = 'Link copied.';
    } catch {
      link.focus();
      link.select();
      status.textContent = 'Copy the selected link.';
    }
  };
  const onTest = () => {
    try {
      const parsed = build();
      close();
      void Promise.resolve().then(() => options.onTest(parsed)).catch((error) => {
        status.textContent = message(error);
        if (!dialog.open) dialog.showModal();
      });
    } catch (error) {
      status.textContent = message(error);
    }
  };
  const onCancelEvent = (event: Event) => { event.preventDefault(); close(); };
  convention.control.addEventListener('change', onConvention);
  routing.control.addEventListener('change', onChange);
  payloadMode.control.addEventListener('change', onChange);
  parameterRows.addEventListener('change', onChange);
  json.addEventListener('input', onChange);
  addParameter.addEventListener('click', onAddParameter);
  cancel.addEventListener('click', onCancel);
  const onCopyClick = () => { void onCopy(); };
  copy.addEventListener('click', onCopyClick);
  test.addEventListener('click', onTest);
  dialog.addEventListener('cancel', onCancelEvent);

  return {
    open(nextTarget) {
      if (disposed || nextTarget.manifest.archetypes.length === 0) return;
      if (dialog.open) close(false);
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      populate(nextTarget);
      dialog.showModal();
      convention.control.focus();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      convention.control.removeEventListener('change', onConvention);
      routing.control.removeEventListener('change', onChange);
      payloadMode.control.removeEventListener('change', onChange);
      parameterRows.removeEventListener('change', onChange);
      json.removeEventListener('input', onChange);
      addParameter.removeEventListener('click', onAddParameter);
      cancel.removeEventListener('click', onCancel);
      copy.removeEventListener('click', onCopyClick);
      test.removeEventListener('click', onTest);
      dialog.removeEventListener('cancel', onCancelEvent);
      close(false);
      dialog.remove();
    },
  };
}
