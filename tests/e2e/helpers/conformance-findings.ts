/**
 * Real Kehto conformance failures the kehto/web#187 suite found. Each is a
 * runtime finding, not a check to relax: specs assert that the failing set is
 * exactly these (plus a mutation's intended checks), so a new failure or a fix
 * that lands without updating this list fails them.
 *
 * - `nip5d/unknown-envelope`: `storage.<unknown action>` is answered with
 *   `storage.<action>.result` + `error: "unknown storage action: …"`, while
 *   NIP-5D (Wire Format) says an unrecognized `type` MUST be silently ignored.
 */
export const KNOWN_KEHTO_FINDINGS: readonly string[] = ['nip5d/unknown-envelope'];
