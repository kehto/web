/**
 * Real Kehto conformance failures the kehto/web#187 suite found, per profile.
 * Each is a runtime (or upstream package) finding, not a check to relax:
 * specs assert that the failing set is exactly these (plus a mutation's
 * intended checks), so a new failure or a fix that lands without updating this
 * list fails them. Details and repros: the #187 PR bodies.
 *
 * - `catalog/acl-denial`: keys, media, outbox (`resolveRelays`), config and
 *   upload still answer ACL denials with `<type>.error`, a type their NAPs do
 *   not define (staging's #463 fixed the other domains).
 * - `catalog/package-drift`: `@napplet/nap@0.41.0` lacks `media.session.ended`
 *   and `webrtc.sendBytes(.result)` that the pinned NAPs specify (upstream).
 * - `relay/semantics`: `relay.publishEncrypted` with a signer that cannot
 *   encrypt publishes an empty-content event and reports `ok: true`.
 */
export const KNOWN_KEHTO_FINDINGS: Readonly<Record<'minimal' | 'full', readonly string[]>> = {
  minimal: [],
  full: [
    'catalog/acl-denial',
    'catalog/package-drift',
    'relay/semantics',
  ],
};
