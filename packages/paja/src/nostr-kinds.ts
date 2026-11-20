/**
 * Nostr event kinds Paja reads or writes. These are wire-contract identifiers,
 * not tunables: changing one breaks interoperability, so they are never Paja
 * settings. NIP-5D napplet kinds come from `@kehto/nip/5d`.
 */

/** NIP-02 contact list. */
export const KIND_CONTACT_LIST = 3;
/** NIP-25 reaction. */
export const KIND_REACTION = 7;
/** NIP-59 gift wrap (NIP-17 direct messages). */
export const KIND_GIFT_WRAP = 1059;
/** NIP-56 report. */
export const KIND_REPORT = 1984;
/** NIP-51 mute list. */
export const KIND_MUTE_LIST = 10_000;
/** NIP-65 relay list metadata. */
export const KIND_RELAY_LIST = 10_002;
/** NIP-51 bookmark list. */
export const KIND_BOOKMARK_LIST = 10_003;
/** Blossom BUD-03 user server list. */
export const KIND_BLOSSOM_SERVER_LIST = 10_063;
/** ContextVM server announcement. */
export const KIND_CVM_SERVER_ANNOUNCEMENT = 11_316;
/** ContextVM tools-list announcement. */
export const KIND_CVM_TOOLS_LIST = 11_317;
/** NIP-46 remote signer request/response. */
export const KIND_NIP46 = 24_133;
/** Ephemeral WebRTC signaling kind proposed by the NIP-100 draft. */
export const KIND_WEBRTC_SIGNAL = 25_050;
/** NIP-51 follow sets. */
export const KIND_FOLLOW_SETS = 30_000;
