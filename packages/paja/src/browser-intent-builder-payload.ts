import { naddrEncode } from 'nostr-tools/nip19';

import { createPajaIntentLink, parsePajaIntentLink, type ParsedPajaIntentLink } from './intent-link.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';
import type { IntentLinkBuilderParameterRow } from './browser-intent-builder-rows.js';

export interface IntentLinkBuilderPayloadInput {
  readonly target: PajaResolvedPointer;
  readonly convention: string;
  readonly rows: readonly IntentLinkBuilderParameterRow[];
  readonly mode: string;
  readonly routing: string;
  readonly json: string;
  readonly href: string;
}

/** Build and re-parse a URL so preview, copy, and Test share one validated descriptor. */
export function buildIntentLinkBuilderPayload(input: IntentLinkBuilderPayloadInput): ParsedPajaIntentLink {
  let uri = input.convention;
  let payload: unknown;
  let hasPayload = false;
  if (input.mode === 'text') {
    const fields: string[] = [];
    for (const row of input.rows) {
      if (!row.included.checked) continue;
      const name = row.name?.value ?? row.nameValue;
      if (!name) throw new TypeError('Included custom parameters need a name.');
      fields.push(`${encodeURIComponent(name)}=${encodeURIComponent(row.value.value)}`);
    }
    if (fields.length > 0) uri = `${uri}?${fields.join('&')}`;
  } else {
    if (!input.json.trim()) throw new TypeError('JSON payload is required in JSON mode.');
    try {
      payload = JSON.parse(input.json);
    } catch {
      throw new TypeError('JSON payload must be valid JSON.');
    }
    hasPayload = true;
  }
  if (input.routing === 'recommend' && input.target.event.kind === 35129 && input.target.manifest.dTag) {
    uri = `${uri}#${naddrEncode({
      identifier: input.target.manifest.dTag,
      pubkey: input.target.event.pubkey,
      kind: 35129,
      relays: [...input.target.pointer.relays],
    })}`;
  }
  const parsed = parsePajaIntentLink(createPajaIntentLink({
    uri,
    ...(input.routing === 'exact' ? { pointer: input.target.pointer.value } : {}),
    ...(hasPayload ? { payload } : {}),
  }, input.href));
  if (!parsed) throw new TypeError('Intent link could not be parsed.');
  return parsed;
}
