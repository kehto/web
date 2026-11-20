/**
 * Real Kehto conformance failures the kehto/web#187 suite found that are still
 * open. Specs assert that the failing set is exactly these (plus a mutation's
 * intended checks), so a new failure or a fix that lands without updating this
 * list fails them. The first finding (`nip5d/unknown-envelope`, storage
 * answering unknown actions) was fixed on staging by #472.
 */
export const KNOWN_KEHTO_FINDINGS: readonly string[] = [];
