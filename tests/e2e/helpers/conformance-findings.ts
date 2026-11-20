/**
 * Real Kehto conformance failures the kehto/web#187 suite found, per profile.
 * Each is a runtime finding, not a check to relax: specs assert that the
 * failing set is exactly these (plus a mutation's intended checks), so a new
 * failure or a fix that lands without updating this list fails them.
 *
 * - `nip5d/unknown-envelope`: `storage.<unknown action>` is answered with
 *   `storage.<action>.result` + `error: "unknown storage action: …"`, while
 *   NIP-5D (Wire Format) says an unrecognized `type` MUST be silently ignored.
 * - `nip5d/push-independent` (full profile, where pushes can be triggered):
 *   `theme.changed` / `identity.changed` reach an endpoint only after it has
 *   sent its first envelope, because the bridge registers the endpoint's
 *   environment lazily (`registerSourceSession`), so a listen-only napplet with
 *   shell exposed depends on `shell.ready` for pushes. NAP-SHELL: "The runtime
 *   MUST NOT gate other domain calls or their availability on this readiness
 *   exchange."
 */
export const KNOWN_KEHTO_FINDINGS: Readonly<Record<'minimal' | 'full', readonly string[]>> = {
  minimal: ['nip5d/unknown-envelope'],
  full: ['nip5d/push-independent', 'nip5d/unknown-envelope'],
};
