/**
 * Real Kehto conformance failures the kehto/web#187 suite found, per profile.
 * Each is a runtime (or upstream package) finding, not a check to relax:
 * specs assert that the failing set is exactly these (plus a mutation's
 * intended checks), so a new failure or a fix that lands without updating this
 * list fails them. Details and repros: the #187 PR bodies.
 *
 * `catalog/package-drift` left with kehto/web#496, once `@napplet/nap@0.43.0`
 * typed `media.session.ended` and `webrtc.sendBytes(.result)` from the pinned
 * NAP-MEDIA and NAP-WEBRTC drafts.
 *
 * - `catalog/package-field-drift` (full; upstream, kehto/web#508):
 *   `@napplet/nap@0.43.0` requires `servers` on `cvm.discover.result`, which
 *   the pinned NAP-CVM table makes optional, and makes optional the primary
 *   field of `upload.info/status/upload.result` and
 *   `intent.available/handlers.result`, which the pinned NAP-UPLOAD and
 *   NAP-INTENT tables require. Minimal reports a `spec-gap` (NAP-IDENTITY's
 *   table and prose disagree on `identity.getProfile.result` `profile`), not
 *   a failure.
 */
export const KNOWN_KEHTO_FINDINGS: Readonly<Record<'minimal' | 'full', readonly string[]>> = {
  minimal: [],
  full: [
    'catalog/package-field-drift',
  ],
};
