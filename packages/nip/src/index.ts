// @kehto/nip — tree-shakable bundle of unique Nostr NIP utilities.
// Each NIP lives at its own subpath (e.g. '@kehto/nip/66'); this barrel
// re-exports them for convenience. sideEffects:false lets bundlers drop
// any NIP a consumer does not import.
export * from './66.js';
