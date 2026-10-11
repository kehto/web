/** NIP-5D napplet manifest event kinds. */

/** Snapshot manifest — regular event, immutable point-in-time release. */
export const NAPPLET_KIND_SNAPSHOT = 5129;
/** Root manifest — replaceable event, an author's latest unnamed napplet. */
export const NAPPLET_KIND_ROOT = 15129;
/** Named manifest — addressable event (carries a `d` tag identifier). */
export const NAPPLET_KIND_NAMED = 35129;

/** All three NIP-5D napplet manifest kinds. */
export const NAPPLET_KINDS: readonly number[] = [
  NAPPLET_KIND_SNAPSHOT,
  NAPPLET_KIND_ROOT,
  NAPPLET_KIND_NAMED,
];
