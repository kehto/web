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
import { neventEncode } from 'nostr-tools/nip19';

import type { PajaResolvedPointer } from './runtime-resolver.js';

const LAUNCHER_HTML = '<!doctype html><meta charset="utf-8"><title>Paja intent launcher</title><script>let launched=false;addEventListener(\'message\',(event)=>{if(launched||event.source!==parent)return;const data=event.data;if(!data||data.type!==\'paja.intent.launch\'||typeof data.uri!==\'string\'||typeof data.correlation!==\'string\')return;launched=true;window.napplet?.intent?.invoke(data.uri,data.options).then((result)=>parent.postMessage({type:\'paja.intent.launcher.result\',correlation:data.correlation,result},\'*\')).catch(()=>parent.postMessage({type:\'paja.intent.launcher.result\',correlation:data.correlation,result:{ok:false,error:\'invoke rejected\'}},\'*\'));});parent.postMessage({type:\'paja.intent.launcher.ready\'},\'*\');</script>';

const LAUNCHER_EVENT: NostrEvent = {
  kind: 35129,
  created_at: 1760054400,
  content: 'Paja verified intent launcher',
  tags: [
    ['d', 'paja-intent-launcher'],
    ['x', '77cf3d2df847786177f4c16eb0b6ae1be6f5cd4e8d9be02a80bccd7c88e51bb8'],
    ['R', 'intent'],
    ['title', 'Paja intent launcher'],
  ],
  pubkey: '24653eac434488002cc06bbfb7f10fe18991e35f9fe4302dbea6d2353dc0ab1c',
  id: '37a0b8b71857b161ea7a8749f4642915c9101258509be6d1ce978e07c683bfb6',
  sig: 'eb8e92509894dd3d86a28111a62412cff86ec36f591e4f3f692b5058174add6ef64c7996d66aae38bbd887355b3338ed6a64b300c8241875619b2e12e87d7903',
};

/** One parent-to-launcher message; it is deliberately outside signed artifact bytes. */
export interface PajaIntentLauncherMessage {
  readonly type: 'paja.intent.launch';
  readonly correlation: string;
  readonly uri: string;
  readonly options?: { readonly payload?: unknown; readonly handler?: string };
}

/** Verify the bundled signed manifest and content-addressed launcher bytes. */
export async function resolvePajaIntentLauncher(): Promise<PajaResolvedPointer> {
  const event = { ...LAUNCHER_EVENT, tags: LAUNCHER_EVENT.tags.map((tag) => [...tag]) } as NostrEvent;
  if (!verifyEvent(event)) throw new Error('Paja intent launcher manifest signature is invalid');
  const resolved = await resolveNapplet({
    event,
    fetchBlob: async (hash) => {
      if (hash !== event.tags[1]?.[1]) throw new Error('Paja intent launcher requested an unknown artifact');
      return new TextEncoder().encode(LAUNCHER_HTML);
    },
  });
  return Object.freeze({
    pointer: Object.freeze({ type: 'nevent', value: neventEncode({ id: event.id, author: event.pubkey, kind: event.kind }), id: event.id, author: event.pubkey, kind: event.kind, relays: Object.freeze([]) }),
    event: Object.freeze({ ...event, tags: Object.freeze(event.tags.map((tag) => Object.freeze([...tag]))) }) as NostrEvent,
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

