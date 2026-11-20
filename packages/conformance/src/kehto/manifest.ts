/**
 * kehto/manifest.ts — Sign and verify the probe's NIP-5D manifest.
 *
 * The first-party target behaves like a real host: it resolves a signed
 * manifest, checks the signature, and hashes the artifact bytes before any
 * frame exists. The keys are fixed test fixtures with no value.
 */
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import type { NostrEvent } from 'nostr-tools';
import { parseNappletManifest, verifyBlobHash, verifyManifestSignature, type NappletManifest } from '@kehto/nip/5d';
import type { ProbeSpec } from '../target.js';

const PUBLISHER_KEYS: Readonly<Record<NonNullable<ProbeSpec['publisher']>, Uint8Array>> = {
  primary: Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 0x51 : 0x11)),
  secondary: Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 0x52 : 0x22)),
};

/** Fixed fixture timestamp, so manifests are byte-stable across runs. */
const MANIFEST_CREATED_AT = 1_760_000_000;

/** Hex public keys of the fixture publishers. */
export const PUBLISHER_PUBKEYS: Readonly<Record<NonNullable<ProbeSpec['publisher']>, string>> = {
  primary: getPublicKey(PUBLISHER_KEYS.primary),
  secondary: getPublicKey(PUBLISHER_KEYS.secondary),
};

/** A probe artifact with its verified identity. */
export interface VerifiedProbe {
  readonly event: NostrEvent;
  readonly manifest: NappletManifest;
  readonly artifact: string;
  /** sha256 of the artifact bytes, computed here and compared with the manifest `x` tag. */
  readonly artifactHash: string;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Publish-and-resolve in one step: sign a manifest for `artifact`, then verify
 * it the way a host does before creating a frame.
 *
 * @param spec - The probe to load.
 * @param artifact - The artifact HTML.
 * @returns The verified manifest and hash.
 * @throws When the signature or the artifact hash does not verify.
 */
export async function publishAndVerifyProbe(spec: ProbeSpec, artifact: string): Promise<VerifiedProbe> {
  const bytes = new TextEncoder().encode(artifact);
  const kind = spec.manifestKind ?? 35129;
  const tags: string[][] = [
    ...(kind === 35129 ? [['d', spec.dTag]] : []),
    ['x', await sha256Hex(bytes)],
    ...(spec.requires ?? []).map((domain) => ['R', domain]),
    ...(spec.optional ?? []).map((domain) => ['O', domain]),
    ['title', `Probe ${spec.plan.label}`],
  ];
  const event = finalizeEvent(
    { kind, created_at: MANIFEST_CREATED_AT, tags, content: `Kehto conformance probe: ${spec.plan.label}` },
    PUBLISHER_KEYS[spec.publisher ?? 'primary'],
  ) as NostrEvent;
  if (!verifyManifestSignature(event)) throw new Error('probe manifest signature did not verify');
  const manifest = parseNappletManifest(event);
  const artifactHash = await sha256Hex(bytes);
  if (!manifest.artifactHash || !verifyBlobHash(bytes, manifest.artifactHash) || manifest.artifactHash !== artifactHash) {
    throw new Error('probe artifact does not match the manifest x tag');
  }
  return { event, manifest, artifact, artifactHash };
}
