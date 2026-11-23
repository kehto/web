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
 * - `catalog/package-field-drift` (full; upstream, kehto/web#508, #518):
 *   `@napplet/nap@0.45.0` (napplet/web#360) aligned the `cvm.discover.result`
 *   and `intent.available/handlers.result` rows with their NAPs. It still makes
 *   `info` / `status` optional on `upload.info.result` / `upload.status.result`,
 *   which the pinned NAP-UPLOAD table requires and no NAP-UPLOAD sentence
 *   omits; that question is open on napplet/naps#33. Kehto's failed
 *   `upload.info` replies already carry `info: { rails: [] }` (#518), so this is
 *   package drift only. `upload.upload.result`
 *   `result` is a recorded table-versus-Error-Handling contradiction, so it is
 *   a `spec-gap` like NAP-IDENTITY's `identity.getProfile.result` `profile`
 *   (napplet/naps#155), not a failure. Minimal reports only that spec gap.
 */
export const KNOWN_KEHTO_FINDINGS: Readonly<Record<'minimal' | 'full', readonly string[]>> = {
  minimal: [],
  full: [
    'catalog/package-field-drift',
  ],
};
