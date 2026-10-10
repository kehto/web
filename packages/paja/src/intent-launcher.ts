/**
 * Verified, ephemeral source for Paja deep-link intent invocation.
 *
 * The launcher event and artifact are static publish-time data.  The signing key
 * used to create the event is deliberately not present in this repository; a
 * link's URI and payload travel only over the parent-bound launcher channel.
 */

import { resolveNapplet } from '@kehto/nip/5d';
import type { NostrEvent } from 'nostr-tools';
import { verifyEvent } from 'nostr-tools/pure';

import type { PajaResolvedPointer } from './runtime-resolver.js';

const LAUNCHER_HTML = '<!doctype html><meta charset="utf-8"><title>Paja intent launcher</title><script>addEventListener(\'message\',(event)=>{if(event.source!==parent)return;const data=event.data;if(!data||data.type!==\'paja.intent.launch\'||typeof data.uri!==\'string\'||typeof data.correlation!==\'string\')return;window.napplet?.intent?.invoke(data.uri,data.options).then((result)=>parent.postMessage({type:\'paja.intent.launcher.result\',correlation:data.correlation,result},\'*\')).catch(()=>parent.postMessage({type:\'paja.intent.launcher.result\',correlation:data.correlation,result:{ok:false,error:\'invoke rejected\'}},\'*\'));});parent.postMessage({type:\'paja.intent.launcher.ready\'},\'*\');</script>';

const LAUNCHER_EVENT: NostrEvent = {
  kind: 35129,
  created_at: 1760054400,
  content: 'Paja verified intent launcher',
  tags: [
    ['d', 'paja-intent-launcher'],
    ['x', 'ba6f4a4d6ad442d80f6b12be8a32c28efdab25dbc5a2328bd6d8cfbf9462e2b2'],
    ['R', 'intent'],
    ['title', 'Paja intent launcher'],
  ],
  pubkey: '24653eac434488002cc06bbfb7f10fe18991e35f9fe4302dbea6d2353dc0ab1c',
  id: 'f5369159c073a976071b999f09cecf3effadd93243239082704f930ddcf7fcbf',
  sig: '6402951fcef4ade2c376147aa92f90d859bccb032d0c28858853dcfc958d89b3a555586a11f635f633fd748bdc993b9b894aa35d0b187564cf8f820916f5417a',
};

/** One parent-to-launcher message; it is deliberately outside signed artifact bytes. */
export interface PajaIntentLauncherMessage {
  readonly type: 'paja.intent.launch';
  readonly correlation: string;
  readonly uri: string;
  readonly options?: { readonly payload?: unknown };
}

/** Verify the bundled signed manifest and content-addressed launcher bytes. */
export async function resolvePajaIntentLauncher(): Promise<PajaResolvedPointer> {
  if (!verifyEvent(LAUNCHER_EVENT)) throw new Error('Paja intent launcher manifest signature is invalid');
  const resolved = await resolveNapplet({
    event: LAUNCHER_EVENT,
    fetchBlob: async (hash) => {
      if (hash !== LAUNCHER_EVENT.tags[1]?.[1]) throw new Error('Paja intent launcher requested an unknown artifact');
      return new TextEncoder().encode(LAUNCHER_HTML);
    },
  });
  return Object.freeze({
    pointer: Object.freeze({ type: 'nevent', value: `nevent:${LAUNCHER_EVENT.id}`, id: LAUNCHER_EVENT.id, relays: Object.freeze([]) }),
    event: LAUNCHER_EVENT,
    relays: Object.freeze([]),
    blossomServers: Object.freeze([]),
    dTag: resolved.dTag,
    aggregateHash: resolved.aggregateHash,
    indexHtml: resolved.indexHtml,
    manifest: resolved.manifest,
  });
}

/** Send a reviewed URI only to the frame registered for this launcher generation. */
export function postPajaIntentLauncherMessage(
  frame: Pick<HTMLIFrameElement, 'contentWindow'>,
  message: PajaIntentLauncherMessage,
): void {
  if (!frame.contentWindow) throw new Error('Paja intent launcher frame is unavailable');
  frame.contentWindow.postMessage(message, '*');
}

