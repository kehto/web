/** Verified routing policy for a shared link's named app and saved preference. */

import { resolveShellEnvironment } from '@kehto/shell';
import { naddrEncode } from 'nostr-tools/nip19';
import { pajaPointerResolverOptions } from './browser-intent-host.js';
import type { PajaBrowserStateContext } from './browser-host.js';
import type { PajaIntentLinkProgress } from './browser-intent-links.js';
import type { InstalledNappletRecord } from './installed-napplet-catalog.js';
import type { ParsedPajaIntentLink } from './intent-link.js';
import { resolvePajaPointer, type PajaResolvedPointer } from './runtime-resolver.js';

type SharedTarget = InstalledNappletRecord | PajaResolvedPointer;

function supports(target: SharedTarget, link: ParsedPajaIntentLink): boolean {
  const contracts = 'manifest' in target ? target.manifest.archetypes : target.archetypes;
  return contracts.some((entry) => entry.slug === link.request.archetype && entry.convention === link.request.convention);
}

function permitted(context: PajaBrowserStateContext, target: SharedTarget): boolean {
  const identity = 'manifest' in target
    ? { dTag: target.dTag, aggregateHash: target.aggregateHash, requires: target.manifest.requires, optional: target.manifest.optional }
    : target;
  return resolveShellEnvironment(context.adapter, identity).capabilities.domains.includes('intent');
}

async function recommended(context: PajaBrowserStateContext, link: ParsedPajaIntentLink): Promise<SharedTarget | null> {
  const hint = link.request.handlerHint;
  if (!hint) return null;
  const installed = context.runtime.catalog.get(`nip5d:${hint.address}`);
  if (installed && supports(installed, link)) return installed;
  const match = /^35129:([a-f0-9]{64}):(.+)$/.exec(hint.address);
  if (!match) return null;
  const [, pubkey, identifier] = match;
  try {
    const pointer = naddrEncode({ identifier, pubkey, kind: 35_129, relays: [...(hint.relays ?? [])] });
    const target = await resolvePajaPointer(pointer, pajaPointerResolverOptions(context));
    return target.event.kind === 35_129 && target.event.pubkey === pubkey
      && target.manifest.dTag === identifier && supports(target, link) ? target : null;
  } catch { return null; }
}

/**
 * Resolve shared app metadata under ordinary verified-pointer navigation policy.
 * A conflict asks the recipient to authorize one of the two named apps; the
 * source URL never silently overrides a saved preference or grants capabilities.
 *
 * @param context - Current catalog, preference, resolver, and ACL policy.
 * @param link - Parsed link with its unchanged opaque payload.
 * @param progress - Navigation generation and recipient app-choice callbacks.
 * @returns Explicit authorized ID for an exact link or conflict choice; otherwise undefined.
 * @example
 * ```ts
 * const selected = await resolvePajaSharedLinkHandler(context, link, progress);
 * ```
 */
export async function resolvePajaSharedLinkHandler(
  context: PajaBrowserStateContext,
  link: ParsedPajaIntentLink,
  progress: PajaIntentLinkProgress,
): Promise<string | undefined> {
  if (link.request.handler === 'choose') return undefined;
  const shared = link.pointer
    ? await resolvePajaPointer(link.pointer, pajaPointerResolverOptions(context))
    : await recommended(context, link);
  if (!progress.isActive() || !shared) return undefined;
  if (!supports(shared, link) || !permitted(context, shared)) {
    if (link.pointer) throw new Error('The named app cannot open this shared content');
    return undefined;
  }
  const id = 'manifest' in shared ? shared.manifest.catalogId : shared.id;
  const title = ('manifest' in shared ? shared.manifest.title : shared.title) ?? shared.dTag;
  const savedId = context.runtime.intentDefaults.get(link.request.archetype);
  const saved = savedId ? context.runtime.catalog.get(savedId) : undefined;
  let selected = id;
  let explicit = link.pointer !== undefined;
  if (!link.pointer && saved && saved.id !== id && supports(saved, link) && permitted(context, saved)) {
    const choice = await progress.chooseConflict(
      { id: saved.id, title: saved.title ?? saved.dTag }, { id, title });
    if (!progress.isActive()) return undefined;
    if (choice !== id && choice !== saved.id) throw new Error('App choice cancelled');
    selected = choice;
    explicit = true;
  }
  if (!progress.isActive()) return undefined;
  // Ordinary link navigation authorizes verified installation/execution under
  // Paja's pointer policy. Discovery alone, or choosing the saved app, does not.
  if (selected === id && 'manifest' in shared) context.runtime.catalog.install(shared);
  progress.selectedTarget(selected === id ? title : saved!.title ?? saved!.dTag);
  return explicit ? selected : undefined;
}
