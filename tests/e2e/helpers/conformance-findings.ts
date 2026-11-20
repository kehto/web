/**
 * Real Kehto conformance failures the kehto/web#187 suite found, per profile.
 * Each is a runtime (or upstream package) finding, not a check to relax:
 * specs assert that the failing set is exactly these (plus a mutation's
 * intended checks), so a new failure or a fix that lands without updating this
 * list fails them. Details and repros: the #187 PR bodies.
 *
 * - `catalog/package-drift`: `@napplet/nap@0.41.0` lacks `media.session.ended`
 *   and `webrtc.sendBytes(.result)` that the pinned NAPs specify (upstream).
 */
export const KNOWN_KEHTO_FINDINGS: Readonly<Record<'minimal' | 'full', readonly string[]>> = {
  minimal: [],
  full: [
    'catalog/package-drift',
  ],
};
