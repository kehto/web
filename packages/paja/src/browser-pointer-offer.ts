import type { PajaPointerNotFoundError } from './runtime-pointer-outcome.js';
import {
  findPajaPointerReplacements,
  type PajaPointerReplacement,
  type FindPajaPointerReplacementsOptions,
} from './runtime-pointer-replacements.js';

const OFFER_ID = 'runtime-pointer-offer';

/** Host hooks for {@link offerPajaPointerReplacements}. */
export interface PajaPointerOfferHost {
  /** Pool and deadline overrides for the follow-up lookup. */
  readonly lookup?: Omit<FindPajaPointerReplacementsOptions, 'relays'>;
  /** Whether the pointer that failed is still the one the user asked for. */
  isCurrent(): boolean;
  /** Append one Paja console entry. */
  log(entry: Record<string, unknown>): void;
  /** Start a fresh, verified load of the chosen `naddr`. */
  open(naddr: string): void;
}

/**
 * Remove any replacement offer from the pointer panel.
 *
 * @example
 * ```ts
 * clearPajaPointerReplacementOffer();
 * ```
 */
export function clearPajaPointerReplacementOffer(): void {
  const container = document.getElementById(OFFER_ID);
  if (!container) return;
  container.replaceChildren();
  container.hidden = true;
}

/**
 * After a `nevent` lookup came back "not found", look for the author's current
 * addressable manifests and offer them as buttons. Nothing loads until the user
 * clicks one, and a click starts an ordinary `naddr` load, so signature, `x`
 * hash, identity, and version consent all run again for the new bytes.
 *
 * @param pointer - The `nevent` that was not found.
 * @param error - The not-found result, carrying the relays that were asked.
 * @param host - Paja state hooks.
 * @returns Resolves once the offer is rendered or skipped.
 * @example
 * ```ts
 * void offerPajaPointerReplacements(pointer, error, { isCurrent, log, open });
 * ```
 */
export async function offerPajaPointerReplacements(
  pointer: string,
  error: PajaPointerNotFoundError,
  host: PajaPointerOfferHost,
): Promise<void> {
  if (error.pointerType !== 'nevent') return;
  const failed = new Set(error.failed.flatMap((entry) => entry.url ? [entry.url] : []));
  const relays = error.relays.filter((url) => !failed.has(url));
  const replacements = await findPajaPointerReplacements(pointer, { ...host.lookup, relays });
  if (replacements.length === 0 || !host.isCurrent()) return;
  host.log({
    type: 'paja.pointer.replacement.offered',
    pointer,
    candidates: replacements.map((entry) => ({ dTag: entry.dTag, naddr: entry.naddr })),
  });
  renderOffer(replacements, host);
}

function renderOffer(replacements: readonly PajaPointerReplacement[], host: PajaPointerOfferHost): void {
  const container = document.getElementById(OFFER_ID);
  if (!container) return;
  const note = document.createElement('p');
  note.textContent = replacements.length === 1
    ? 'This exact event is gone; the author likely replaced it. The author currently publishes this napplet of the same kind:'
    : 'This exact event is gone; the author likely replaced it. A nevent does not say which napplet it was, so pick one of the author\'s current napplets of the same kind:';
  const list = document.createElement('div');
  list.className = 'pointer-offer-list';
  for (const entry of replacements) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.naddr = entry.naddr;
    button.textContent = `Open ${entry.title ?? entry.dTag} (d=${entry.dTag}, ${new Date(entry.createdAt * 1000).toISOString().slice(0, 16)}Z)`;
    button.addEventListener('click', () => {
      host.log({ type: 'paja.pointer.replacement.chosen', dTag: entry.dTag, naddr: entry.naddr });
      clearPajaPointerReplacementOffer();
      host.open(entry.naddr);
    });
    list.append(button);
  }
  container.replaceChildren(note, list);
  container.hidden = false;
}
